import type { DB } from '../db';
import { censor } from '../moderation';
import { assert, notify, ownsCard } from './core';

/* ------------------------------------------------------------------ */
/* Vitrines (6 cartes, plusieurs vitrines nommées, une principale)      */
/* ------------------------------------------------------------------ */

export const SHOWCASE_SLOTS = 6;
export const MAX_SHOWCASES = 5;

export function listShowcases(db: DB, userId: number) {
	const rows = db.prepare('SELECT id, name, is_main FROM showcases WHERE user_id = ? ORDER BY is_main DESC, id').all(userId) as {
		id: number;
		name: string;
		is_main: number;
	}[];
	const cards = db.prepare('SELECT slot, card_id FROM showcase_cards WHERE showcase_id = ? ORDER BY slot');
	return rows.map((r) => ({ ...r, cardIds: (cards.all(r.id) as { slot: number; card_id: number }[]).map((c) => c.card_id) }));
}

export function saveShowcase(db: DB, userId: number, showcaseId: number | null, name: string, cardIds: number[], now = Date.now()) {
	return db.transaction(() => {
		const n = censor(name.trim().slice(0, 30)) || 'Vitrine';
		assert(cardIds.length <= SHOWCASE_SLOTS, `${SHOWCASE_SLOTS} cartes maximum.`);
		assert(new Set(cardIds).size === cardIds.length, 'Une carte ne peut apparaître qu’une fois.');
		for (const id of cardIds) assert(ownsCard(db, userId, id), 'Tu ne possèdes pas une des cartes choisies.');
		let id = showcaseId;
		if (id) {
			assert(db.prepare('SELECT 1 FROM showcases WHERE id = ? AND user_id = ?').get(id, userId), 'Vitrine introuvable.');
			db.prepare('UPDATE showcases SET name = ? WHERE id = ?').run(n, id);
		} else {
			const count = (db.prepare('SELECT COUNT(*) n FROM showcases WHERE user_id = ?').get(userId) as { n: number }).n;
			assert(count < MAX_SHOWCASES, `${MAX_SHOWCASES} vitrines maximum.`);
			id = Number(db.prepare('INSERT INTO showcases (user_id, name, is_main, created_at) VALUES (?, ?, ?, ?)').run(userId, n, count === 0 ? 1 : 0, now).lastInsertRowid);
		}
		db.prepare('DELETE FROM showcase_cards WHERE showcase_id = ?').run(id);
		const ins = db.prepare('INSERT INTO showcase_cards (showcase_id, slot, card_id) VALUES (?, ?, ?)');
		cardIds.forEach((c, i) => ins.run(id, i, c));
		return id;
	})();
}

export function setMainShowcase(db: DB, userId: number, showcaseId: number) {
	assert(db.prepare('SELECT 1 FROM showcases WHERE id = ? AND user_id = ?').get(showcaseId, userId), 'Vitrine introuvable.');
	db.prepare('UPDATE showcases SET is_main = (id = ?) WHERE user_id = ?').run(showcaseId, userId);
}

export function deleteShowcase(db: DB, userId: number, showcaseId: number) {
	return db.transaction(() => {
		const s = db.prepare('SELECT is_main FROM showcases WHERE id = ? AND user_id = ?').get(showcaseId, userId) as { is_main: number } | undefined;
		assert(s, 'Vitrine introuvable.');
		db.prepare('DELETE FROM showcases WHERE id = ?').run(showcaseId);
		if (s.is_main) db.prepare('UPDATE showcases SET is_main = 1 WHERE id = (SELECT id FROM showcases WHERE user_id = ? ORDER BY id LIMIT 1)').run(userId);
	})();
}

/** Aperçu des vitrines principales (3 premières cartes) pour plusieurs joueurs. */
export function showcasePreviews(db: DB, userIds: number[], limit = 3) {
	const out = new Map<number, number[]>();
	if (!userIds.length) return out;
	const rows = db
		.prepare(
			`SELECT s.user_id, sc.card_id FROM showcases s JOIN showcase_cards sc ON sc.showcase_id = s.id
			 WHERE s.is_main = 1 AND s.user_id IN (${userIds.map(() => '?').join(',')}) AND sc.slot < ? ORDER BY s.user_id, sc.slot`
		)
		.all(...userIds, limit) as { user_id: number; card_id: number }[];
	for (const r of rows) out.set(r.user_id, [...(out.get(r.user_id) ?? []), r.card_id]);
	return out;
}

/* ------------------------------------------------------------------ */
/* Avatar-carte, profil privé                                           */
/* ------------------------------------------------------------------ */

export function setAvatar(db: DB, userId: number, cardId: number | null, x = 50, y = 40) {
	if (cardId != null) assert(ownsCard(db, userId, cardId), 'Choisis une carte de ta collection.');
	const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 50)));
	db.prepare('UPDATE users SET avatar_card_id = ?, avatar_x = ?, avatar_y = ? WHERE id = ?').run(cardId, clamp(x), clamp(y), userId);
}

export function setPrivate(db: DB, userId: number, isPrivate: boolean) {
	db.prepare('UPDATE users SET is_private = ? WHERE id = ?').run(isPrivate ? 1 : 0, userId);
}

/* ------------------------------------------------------------------ */
/* Liste de souhaits                                                    */
/* ------------------------------------------------------------------ */

export function toggleWish(db: DB, userId: number, cardId: number, now = Date.now()) {
	const del = db.prepare('DELETE FROM wishlist WHERE user_id = ? AND card_id = ?').run(userId, cardId);
	if (del.changes) return false;
	const n = (db.prepare('SELECT COUNT(*) n FROM wishlist WHERE user_id = ?').get(userId) as { n: number }).n;
	assert(n < 200, '200 cartes maximum dans la liste de souhaits.');
	db.prepare('INSERT INTO wishlist (user_id, card_id, created_at) VALUES (?, ?, ?)').run(userId, cardId, now);
	return true;
}

export const isWished = (db: DB, userId: number, cardId: number) => !!db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND card_id = ?').get(userId, cardId);

/** Prévient les joueurs qui souhaitent cette carte qu'elle vient d'être mise aux enchères. */
export function notifyWishers(db: DB, cardId: number, cardName: string, sellerId: number, auctionId: number, now = Date.now()) {
	const rows = db.prepare('SELECT user_id FROM wishlist WHERE card_id = ? AND user_id <> ?').all(cardId, sellerId) as { user_id: number }[];
	for (const r of rows) {
		if (isBlockedEither(db, r.user_id, sellerId)) continue;
		notify(db, r.user_id, 'wish', `${cardName}, de ta liste de souhaits, est en vente aux enchères !`, `/market/${auctionId}`, now);
	}
	return rows.length;
}

/* ------------------------------------------------------------------ */
/* Blocage et signalement                                               */
/* ------------------------------------------------------------------ */

export function isBlockedEither(db: DB, a: number, b: number) {
	return !!db.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)').get(a, b, b, a);
}

export function assertNotBlocked(db: DB, a: number, b: number) {
	assert(!isBlockedEither(db, a, b), 'Action impossible avec ce joueur.');
}

export function toggleBlock(db: DB, userId: number, targetId: number, now = Date.now()) {
	assert(userId !== targetId, 'Tu ne peux pas te bloquer toi-même.');
	const del = db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').run(userId, targetId);
	if (del.changes) return false;
	db.prepare('INSERT INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').run(userId, targetId, now);
	// Un blocage retire l'amitié
	db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, targetId, targetId, userId);
	return true;
}

export const REPORT_REASONS = ['Triche', 'Insultes ou harcèlement', 'Pseudo ou contenu inapproprié', 'Spam', 'Autre'];

export function reportUser(db: DB, reporterId: number, targetId: number, reason: string, details: string, now = Date.now()) {
	assert(reporterId !== targetId, 'Tu ne peux pas te signaler toi-même.');
	assert(REPORT_REASONS.includes(reason), 'Motif invalide.');
	const recent = (db.prepare('SELECT COUNT(*) n FROM reports WHERE reporter_id = ? AND created_at > ?').get(reporterId, now - 86_400_000) as { n: number }).n;
	assert(recent < 10, 'Trop de signalements aujourd’hui.');
	db.prepare('INSERT INTO reports (reporter_id, target_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?)').run(
		reporterId,
		targetId,
		reason,
		details.trim().slice(0, 500) || null,
		now
	);
	const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as { id: number }[];
	for (const a of admins) notify(db, a.id, 'report', `Nouveau signalement : ${reason}`, '/admin', now);
}

/* ------------------------------------------------------------------ */
/* Points de guilde (entraide)                                          */
/* ------------------------------------------------------------------ */

export const WISH_GIFT_POINTS = [100, 150, 250, 400, 700, 1200];

/** Le donneur gagne des points pour sa guilde si le receveur, membre de la même guilde, souhaitait la carte. */
export function awardWishGift(db: DB, giverId: number, receiverId: number, cardId: number, rarity: number, now = Date.now()) {
	const g = db.prepare('SELECT a.guild_id FROM users a JOIN users b ON b.guild_id = a.guild_id WHERE a.id = ? AND b.id = ? AND a.guild_id IS NOT NULL').get(giverId, receiverId) as
		| { guild_id: number }
		| undefined;
	if (!g || !isWished(db, receiverId, cardId)) return 0;
	const pts = WISH_GIFT_POINTS[rarity] ?? 100;
	db.prepare('INSERT INTO guild_points (guild_id, user_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(g.guild_id, giverId, pts, `wish:${cardId}`, now);
	db.prepare('DELETE FROM wishlist WHERE user_id = ? AND card_id = ?').run(receiverId, cardId);
	notify(db, giverId, 'guild', `+${pts} points de guilde : tu as offert une carte souhaitée par un membre !`, '/guilds', now);
	return pts;
}

/* ------------------------------------------------------------------ */
/* Étiquettes libres                                                    */
/* ------------------------------------------------------------------ */

export const MAX_TAGS = 30;

export function cleanTag(tag: string) {
	const t = censor(tag.replace(/\s+/g, ' ').trim().slice(0, 24));
	assert(t.length >= 2 && !t.includes('*'), 'Étiquette : 2 à 24 caractères, sans insulte.');
	return t;
}

export function tagCards(db: DB, userId: number, cardIds: number[], tag: string, now = Date.now()) {
	return db.transaction(() => {
		const t = cleanTag(tag);
		const exists = db.prepare('SELECT 1 FROM card_tags WHERE user_id = ? AND tag = ? LIMIT 1').get(userId, t);
		if (!exists) {
			const n = (db.prepare('SELECT COUNT(DISTINCT tag) n FROM card_tags WHERE user_id = ?').get(userId) as { n: number }).n;
			assert(n < MAX_TAGS, `${MAX_TAGS} étiquettes maximum.`);
		}
		assert(cardIds.length > 0 && cardIds.length <= 500, 'Sélection invalide.');
		const ins = db.prepare('INSERT OR IGNORE INTO card_tags (user_id, card_id, tag, created_at) VALUES (?, ?, ?, ?)');
		let n = 0;
		for (const id of cardIds) if (ownsCard(db, userId, id)) n += ins.run(userId, id, t, now).changes;
		return { tag: t, added: n };
	})();
}

export function untagCards(db: DB, userId: number, cardIds: number[], tag: string) {
	const del = db.prepare('DELETE FROM card_tags WHERE user_id = ? AND card_id = ? AND tag = ?');
	let n = 0;
	for (const id of cardIds) n += del.run(userId, id, tag).changes;
	return n;
}

export function userTags(db: DB, userId: number) {
	return db.prepare('SELECT tag, COUNT(*) n FROM card_tags WHERE user_id = ? GROUP BY tag ORDER BY n DESC, tag').all(userId) as { tag: string; n: number }[];
}

export function setFavorites(db: DB, userId: number, cardIds: number[], on: boolean) {
	const ins = db.prepare('INSERT OR IGNORE INTO favorites (user_id, card_id) VALUES (?, ?)');
	const del = db.prepare('DELETE FROM favorites WHERE user_id = ? AND card_id = ?');
	let n = 0;
	for (const id of cardIds) n += on ? (ownsCard(db, userId, id) ? ins.run(userId, id).changes : 0) : del.run(userId, id).changes;
	return n;
}
