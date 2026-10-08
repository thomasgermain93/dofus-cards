import webpush from 'web-push';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from './db';
import { PACK_INTERVAL_MS, PACK_MAX } from './game/constants';
import { GAME_NAME } from '../config';

/**
 * Notifications Web Push (VAPID). Les clés sont créées au premier démarrage dans DATA_DIR/vapid.json.
 * Rien n'est envoyé tant que initPush() n'a pas été appelé (tests).
 */
let publicKey: string | null = null;

export function initPush(dataDir: string) {
	if (publicKey) return publicKey;
	const file = join(dataDir, 'vapid.json');
	let keys: { publicKey: string; privateKey: string };
	if (existsSync(file)) keys = JSON.parse(readFileSync(file, 'utf8'));
	else {
		keys = webpush.generateVAPIDKeys();
		writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
	}
	webpush.setVapidDetails('mailto:contact@hungrynuggets.be', keys.publicKey, keys.privateKey);
	publicKey = keys.publicKey;
	return publicKey;
}

export const vapidPublicKey = () => publicKey;

export function saveSubscription(db: DB, userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
	db.prepare(
		'INSERT INTO push_subscriptions (endpoint, user_id, keys, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys'
	).run(sub.endpoint, userId, JSON.stringify(sub.keys), Date.now());
}

export function removeSubscription(db: DB, endpoint: string) {
	db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

/** Envoi asynchrone (hors transaction) ; les abonnements expirés sont supprimés. */
export function queuePush(db: DB, userId: number, body: string, url = '/') {
	if (!publicKey) return;
	const subs = db.prepare('SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?').all(userId) as { endpoint: string; keys: string }[];
	if (!subs.length) return;
	setImmediate(() => {
		for (const s of subs) {
			webpush
				.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify({ title: GAME_NAME, body, url }), { TTL: 3600 })
				.catch((e: { statusCode?: number }) => {
					if (e?.statusCode === 404 || e?.statusCode === 410) removeSubscription(db, s.endpoint);
				});
		}
	});
}

/** Tâche planifiée : prévient (une fois) quand la réserve de paquets est pleine. */
export function notifyFullReserves(db: DB, now = Date.now()) {
	if (!publicKey) return 0;
	const users = db
		.prepare(
			'SELECT DISTINCT u.id, u.pack_stock, u.pack_anchor, u.push_pack_notified FROM users u JOIN push_subscriptions p ON p.user_id = u.id WHERE u.banned = 0'
		)
		.all() as { id: number; pack_stock: number; pack_anchor: number; push_pack_notified: number }[];
	let n = 0;
	for (const u of users) {
		const fullAt = u.pack_stock >= PACK_MAX ? u.pack_anchor : u.pack_anchor + (PACK_MAX - u.pack_stock) * PACK_INTERVAL_MS;
		if (now >= fullAt && u.push_pack_notified < fullAt) {
			db.prepare('UPDATE users SET push_pack_notified = ? WHERE id = ?').run(now, u.id);
			queuePush(db, u.id, 'Ta réserve de paquets est pleine : 10 paquets t’attendent !', '/');
			n++;
		}
	}
	return n;
}
