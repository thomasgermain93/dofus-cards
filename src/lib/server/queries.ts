import type { DB } from './db';
import { CARD_COLS } from './web';
import type { CardView } from '#lib/types';

/** Cartes possédées (une ligne par carte) avec le nombre d'exemplaires libres. */
export function ownedCards(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT ${CARD_COLS}, COUNT(*) total, SUM(uc.locked IS NULL) free
			 FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ?
			 GROUP BY c.id ORDER BY c.rarity DESC, c.attack DESC`
		)
		.all(userId) as (CardView & { total: number; free: number })[];
}

export function cardsByIds(db: DB, ids: number[]) {
	if (!ids.length) return [];
	const rows = db.prepare(`SELECT ${CARD_COLS} FROM cards c WHERE c.id IN (${ids.map(() => '?').join(',')})`).all(...ids) as CardView[];
	const map = new Map(rows.map((r) => [r.id, r]));
	return ids.map((id) => map.get(id)).filter((c): c is CardView => !!c);
}

export function friendsOf(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT u.id, u.username FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
			 WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' AND u.banned = 0 ORDER BY u.username`
		)
		.all(userId, userId, userId) as { id: number; username: string }[];
}
