import { getDb } from '#lib/server/db';
import { toggleWish } from '#lib/server/game/profile';
import { CARD_COLS, int, run } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const cards = db
		.prepare(
			`SELECT ${CARD_COLS},
				(SELECT COUNT(*) FROM user_cards x WHERE x.user_id = ? AND x.card_id = c.id) owned,
				(SELECT a.id FROM auctions a WHERE a.card_id = c.id AND a.status = 'open' AND a.seller_id <> ? ORDER BY a.ends_at LIMIT 1) auction_id,
				(SELECT COALESCE(a.current_bid, a.start_price) FROM auctions a WHERE a.card_id = c.id AND a.status = 'open' AND a.seller_id <> ? ORDER BY a.ends_at LIMIT 1) auction_price
			 FROM wishlist w JOIN cards c ON c.id = w.card_id WHERE w.user_id = ? ORDER BY c.rarity DESC, w.created_at DESC`
		)
		.all(uid, uid, uid, uid) as (CardView & { owned: number; auction_id: number | null; auction_price: number | null })[];
	// Amis qui ont la carte en double (proposer un échange)
	const friendDupes = db.prepare(
		`SELECT u.username FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
		 WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
		 AND (SELECT COUNT(*) FROM user_cards x WHERE x.user_id = u.id AND x.card_id = ? AND x.locked IS NULL) >= 2 LIMIT 3`
	);
	return {
		cards: cards.map((c) => ({ ...c, friends: (friendDupes.all(uid, uid, uid, c.id) as { username: string }[]).map((f) => f.username) }))
	};
};

export const actions: Actions = {
	toggle: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => ({ wished: toggleWish(getDb(), uid, int(f.get('card'))) }));
	}
};
