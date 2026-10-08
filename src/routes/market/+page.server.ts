import { getDb } from '#lib/server/db';
import { CARD_COLS, int } from '#lib/server/web';
import type { PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export type AuctionItem = CardView & {
	auction_id: number;
	start_price: number;
	current_bid: number | null;
	bid_count: number;
	ends_at: number;
	status: string;
	bidder_id: number | null;
	seller: string;
	owned_by_me: number;
};

export const load: PageServerLoad = ({ locals, url }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const p = url.searchParams;
	const tab = ['mine', 'bids', 'history'].includes(p.get('tab') ?? '') ? p.get('tab')! : 'all';
	const rarity = int(p.get('r'), -1);
	const q = (p.get('q') ?? '').trim().slice(0, 60);

	const where: string[] = [];
	const args: unknown[] = [];
	if (tab === 'all') where.push("a.status = 'open'", 'a.seller_id <> ?'), args.push(uid);
	if (tab === 'mine') where.push("a.status <> 'cancelled'", 'a.seller_id = ?'), args.push(uid);
	if (tab === 'bids') where.push('a.id IN (SELECT auction_id FROM bids WHERE user_id = ?)'), args.push(uid);
	if (tab === 'history') where.push("a.status = 'sold'");
	if (rarity >= 0 && rarity <= 5) where.push('c.rarity = ?'), args.push(rarity);
	if (q) where.push("norm(c.name) LIKE '%' || norm(?) || '%'"), args.push(q);

	const auctions = db
		.prepare(
			`SELECT a.id auction_id, a.start_price, a.current_bid, a.bid_count, a.ends_at, a.status, a.bidder_id, u.username seller,
				(SELECT COUNT(*) FROM user_cards x WHERE x.user_id = ? AND x.card_id = c.id) owned_by_me, ${CARD_COLS}
			 FROM auctions a JOIN cards c ON c.id = a.card_id JOIN users u ON u.id = a.seller_id
			 WHERE ${where.join(' AND ')}
			 ORDER BY ${tab === 'all' ? 'a.ends_at ASC' : 'a.id DESC'} LIMIT 60`
		)
		.all(uid, ...args) as AuctionItem[];
	return { auctions, tab, rarity, q, now: Date.now() };
};
