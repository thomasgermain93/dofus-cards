import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { openPack, type PackSource } from '#lib/server/game/packs';
import { claimDaily, claimChest } from '#lib/server/game/retention';
import { claimQuest } from '#lib/server/game/quests';
import { getUser } from '#lib/server/game/core';
import { cryptoRng } from '#lib/server/game/rng';
import { retentionSummary } from '#lib/server/queries';
import { CARD_COLS, int, limit, run, str } from '#lib/server/web';
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
		retention: retentionSummary(db, u.id),
		owned: n('SELECT COUNT(DISTINCT card_id) n FROM user_cards WHERE user_id = ?', u.id),
		shinies: n('SELECT COUNT(*) n FROM user_cards WHERE user_id = ? AND shiny = 1', u.id),
		total: n('SELECT COUNT(*) n FROM cards WHERE active = 1'),
		notifications: db
			.prepare('SELECT id, kind, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 5')
			.all(u.id) as { id: number; kind: string; body: string; link: string | null; read_at: number | null; created_at: number }[],
		lastCards: db
			.prepare(`SELECT ${CARD_COLS} FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? GROUP BY c.id ORDER BY c.rarity DESC, MAX(uc.id) DESC LIMIT 3`)
			.all(u.id) as CardView[]
	};
};

export const actions: Actions = {
	open: async ({ locals, request }) => {
		const f = await request.formData().catch(() => new FormData());
		const source = (['bronze', 'silver', 'gold', 'welcome'].includes(str(f.get('source'))) ? str(f.get('source')) : 'free') as PackSource;
		return run(locals, (uid) => {
			limit(`open:${uid}`, 20, 60_000);
			const res = openPack(getDb(), uid, cryptoRng, Date.now(), source);
			return {
				opened: res.map((r) => ({
					isNew: r.isNew,
					shiny: r.shiny,
					card: {
						id: r.card.id, name: r.card.name, image: r.card.image, category: r.card.category, subtype: r.card.subtype,
						level: r.card.level, rarity: r.card.rarity, attack: r.card.attack, defense: r.card.defense, info1: r.card.info1, info2: r.card.info2, flavor: r.card.flavor
					}
				}))
			};
		});
	},
	daily: ({ locals }) => run(locals, (uid) => ({ daily: claimDaily(getDb(), uid) })),
	quest: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => ({ quest: claimQuest(getDb(), uid, int(f.get('id'))) }));
	},
	chest: ({ locals }) => run(locals, (uid) => ({ chest: claimChest(getDb(), uid) })),
	readNotifs: ({ locals }) => {
		if (!locals.user) return fail(401);
		getDb().prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), locals.user.id);
		return { ok: true };
	}
};
