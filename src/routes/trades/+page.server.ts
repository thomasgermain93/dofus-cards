import { getDb } from '#lib/server/db';
import { parseIds } from '#lib/server/game/core';
import { cardsByIds } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const rows = db
		.prepare(
			`SELECT t.*, uf.username from_name, ut.username to_name FROM trades t
			 JOIN users uf ON uf.id = t.from_id JOIN users ut ON ut.id = t.to_id
			 WHERE t.from_id = ? OR t.to_id = ? ORDER BY (t.status = 'pending') DESC, t.id DESC LIMIT 50`
		)
		.all(uid, uid) as { id: number; from_id: number; to_id: number; from_name: string; to_name: string; offer_cards: string; request_cards: string; offer_kamas: number; status: string; created_at: number }[];
	return {
		trades: rows.map((t) => ({ ...t, offer: cardsByIds(db, parseIds(t.offer_cards)), request: cardsByIds(db, parseIds(t.request_cards)) }))
	};
};
