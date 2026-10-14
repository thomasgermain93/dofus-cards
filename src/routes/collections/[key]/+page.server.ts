import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { userCollections, KIND_LABEL } from '#lib/server/game/collections';
import { cardsByIds } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const c = userCollections(db, uid).find((x) => x.key === params.key);
	if (!c) error(404, 'Collection introuvable');
	const owned = new Map(
		(db.prepare(`SELECT card_id, COUNT(*) n, SUM(shiny) s FROM user_cards WHERE user_id = ? AND card_id IN (${c.cardIds.map(() => '?').join(',')}) GROUP BY card_id`).all(uid, ...c.cardIds) as {
			card_id: number;
			n: number;
			s: number;
		}[]).map((r) => [r.card_id, r])
	);
	const cards = cardsByIds(db, c.cardIds)
		.sort((a, b) => a.rarity - b.rarity || a.level - b.level)
		.map((card) => ({ card, count: owned.get(card.id)?.n ?? 0, shiny: (owned.get(card.id)?.s ?? 0) > 0 }));
	const { cardIds, rarities, ...meta } = c;
	return { collection: { ...meta, kindLabel: KIND_LABEL[c.kind] }, cards };
};
