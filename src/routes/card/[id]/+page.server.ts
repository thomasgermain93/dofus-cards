import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { sellableCounts } from '#lib/server/game/collection';
import { createAuction } from '#lib/server/game/auctions';
import { AUCTION_DURATIONS_H, CRAFT_COSTS, RECYCLE_VALUES, SELL_VALUES } from '#lib/server/game/constants';
import { craftCard } from '#lib/server/game/collection';
import { isWished, toggleWish, userTags } from '#lib/server/game/profile';
import { CARD_COLS, int, limit, run } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const id = int(params.id);
	const card = db.prepare(`SELECT ${CARD_COLS}, c.facts FROM cards c WHERE c.id = ?`).get(id) as (CardView & { facts: string }) | undefined;
	if (!card) error(404, 'Carte introuvable');
	const copies = db.prepare('SELECT COUNT(*) n, SUM(locked IS NULL) free FROM user_cards WHERE user_id = ? AND card_id = ?').get(uid, id) as {
		n: number;
		free: number | null;
	};
	const fav = !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND card_id = ?').get(uid, id);
	const auctions = db
		.prepare(
			`SELECT a.id, a.start_price, a.current_bid, a.ends_at, u.username seller FROM auctions a JOIN users u ON u.id = a.seller_id
			 WHERE a.card_id = ? AND a.status = 'open' ORDER BY a.ends_at LIMIT 10`
		)
		.all(id) as { id: number; start_price: number; current_bid: number | null; ends_at: number; seller: string }[];
	const owners = (db.prepare('SELECT COUNT(DISTINCT user_id) n FROM user_cards WHERE card_id = ?').get(id) as { n: number }).n;
	const lastSale = db.prepare("SELECT current_bid FROM auctions WHERE card_id = ? AND status = 'sold' ORDER BY id DESC LIMIT 1").get(id) as
		| { current_bid: number }
		| undefined;
	const { facts, ...view } = card;
	const circulation = (db.prepare('SELECT COUNT(*) n FROM user_cards WHERE card_id = ?').get(id) as { n: number }).n;
	const sales = db
		.prepare("SELECT current_bid price, ends_at at FROM auctions WHERE card_id = ? AND status = 'sold' ORDER BY ends_at DESC LIMIT 20")
		.all(id) as { price: number; at: number }[];
	const friendsOwning = db
		.prepare(
			`SELECT u.username, COUNT(uc.id) n FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
			 JOIN user_cards uc ON uc.user_id = u.id AND uc.card_id = ?
			 WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' GROUP BY u.id ORDER BY n DESC LIMIT 10`
		)
		.all(uid, id, uid, uid) as { username: string; n: number }[];
	const wishers = (db.prepare('SELECT COUNT(*) n FROM wishlist WHERE card_id = ?').get(id) as { n: number }).n;
	return {
		card: view,
		facts: JSON.parse(facts || '{}') as Record<string, unknown>,
		owned: copies.n,
		free: copies.free ?? 0,
		fav,
		auctions,
		owners,
		circulation,
		sales: sales.reverse(),
		friendsOwning,
		wishers,
		wished: isWished(db, uid, id),
		tags: (db.prepare('SELECT tag FROM card_tags WHERE user_id = ? AND card_id = ? ORDER BY tag').all(uid, id) as { tag: string }[]).map((t) => t.tag),
		myTags: userTags(db, uid).map((t) => t.tag),
		lastSale: lastSale?.current_bid ?? null,
		sellValue: SELL_VALUES[card.rarity],
		recycleValue: RECYCLE_VALUES[card.rarity],
		craftCost: CRAFT_COSTS[card.rarity],
		fragments: (db.prepare('SELECT fragments n FROM users WHERE id = ?').get(uid) as { n: number }).n,
		shinyCount: (db.prepare('SELECT COUNT(*) n FROM user_cards WHERE user_id = ? AND card_id = ? AND shiny = 1').get(uid, id) as { n: number }).n,
		sellable: sellableCounts(db, uid, [id]).get(id) ?? 0,
		inTrade: Math.max(0, (copies.free ?? 0) - (sellableCounts(db, uid, [id]).get(id) ?? 0)),
		durations: AUCTION_DURATIONS_H
	};
};

export const actions: Actions = {
	wish: ({ locals, params }) => run(locals, (uid) => ({ wished: toggleWish(getDb(), uid, int(params.id)) })),
	craft: ({ locals, params }) =>
		run(locals, (uid) => {
			limit(`craft:${uid}`, 20, 60_000);
			return { crafted: craftCard(getDb(), uid, int(params.id)) };
		}),
	fav: ({ locals, params }) =>
		run(locals, (uid) => {
			const db = getDb();
			const id = int(params.id);
			const del = db.prepare('DELETE FROM favorites WHERE user_id = ? AND card_id = ?').run(uid, id);
			if (!del.changes) db.prepare('INSERT INTO favorites (user_id, card_id) VALUES (?, ?)').run(uid, id);
			return { fav: !del.changes };
		}),
	sell: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`sell:${uid}`, 10, 60_000);
			const auctionId = createAuction(getDb(), uid, int(params.id), int(f.get('price')), int(f.get('duration')));
			return { auctionId };
		});
	}
};
