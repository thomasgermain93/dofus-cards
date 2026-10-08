import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { openPack } from '#lib/server/game/packs';
import { claimDaily, dailyAvailable } from '#lib/server/game/collection';
import { getUser } from '#lib/server/game/core';
import { cryptoRng } from '#lib/server/game/rng';
import { CARD_COLS, limit, run } from '#lib/server/web';
import { DAILY_BASE_KAMAS } from '#lib/server/game/constants';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	if (!locals.user) {
		// Page d'accueil publique : quelques cartes en vitrine
		const showcase = db
			.prepare(`SELECT ${CARD_COLS} FROM cards c WHERE active = 1 AND rarity >= 4 AND image IS NOT NULL ORDER BY random() LIMIT 3`)
			.all() as CardView[];
		const total = (db.prepare('SELECT COUNT(*) n FROM cards WHERE active = 1').get() as { n: number }).n;
		return { showcase, total };
	}
	const u = getUser(db, locals.user.id);
	const n = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n;
	return {
		dailyAvailable: dailyAvailable(u.daily_last, Date.now()),
		dailyStreak: u.daily_streak,
		dailyBase: DAILY_BASE_KAMAS,
		owned: n('SELECT COUNT(DISTINCT card_id) n FROM user_cards WHERE user_id = ?', u.id),
		total: n('SELECT COUNT(*) n FROM cards WHERE active = 1'),
		notifications: db
			.prepare('SELECT id, kind, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 5')
			.all(u.id) as { id: number; kind: string; body: string; link: string | null; read_at: number | null; created_at: number }[],
		lastCards: db
			.prepare(`SELECT ${CARD_COLS} FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? ORDER BY c.rarity DESC, uc.id DESC LIMIT 3`)
			.all(u.id) as CardView[]
	};
};

export const actions: Actions = {
	open: ({ locals }) =>
		run(locals, (uid) => {
			limit(`open:${uid}`, 20, 60_000);
			const res = openPack(getDb(), uid, cryptoRng);
			return {
				opened: res.map((r) => ({
					isNew: r.isNew,
					card: {
						id: r.card.id, name: r.card.name, image: r.card.image, category: r.card.category, subtype: r.card.subtype,
						level: r.card.level, rarity: r.card.rarity, attack: r.card.attack, defense: r.card.defense, info1: r.card.info1, info2: r.card.info2
					}
				}))
			};
		}),
	daily: ({ locals }) =>
		run(locals, (uid) => {
			const r = claimDaily(getDb(), uid);
			return { daily: r };
		}),
	readNotifs: ({ locals }) => {
		if (!locals.user) return fail(401);
		getDb().prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), locals.user.id);
		return { ok: true };
	}
};
