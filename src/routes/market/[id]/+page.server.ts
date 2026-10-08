import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { cancelAuction, minNextBid, placeBid, settleAuction, type AuctionRow } from '#lib/server/game/auctions';
import { CARD_COLS, int, limit, run } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const id = int(params.id);
	settleAuction(db, id); // clôture immédiate si l'échéance est passée
	const a = db.prepare('SELECT a.*, u.username seller FROM auctions a JOIN users u ON u.id = a.seller_id WHERE a.id = ?').get(id) as
		| (AuctionRow & { seller: string })
		| undefined;
	if (!a) error(404, 'Enchère introuvable');
	const card = db.prepare(`SELECT ${CARD_COLS} FROM cards c WHERE c.id = ?`).get(a.card_id) as CardView;
	const bids = db
		.prepare('SELECT b.amount, b.created_at, u.username FROM bids b JOIN users u ON u.id = b.user_id WHERE b.auction_id = ? ORDER BY b.id DESC LIMIT 20')
		.all(id) as { amount: number; created_at: number; username: string }[];
	const owned = (db.prepare('SELECT COUNT(*) n FROM user_cards WHERE user_id = ? AND card_id = ?').get(locals.user!.id, a.card_id) as { n: number }).n;
	return { auction: a, card, bids, minBid: minNextBid(a), owned, now: Date.now() };
};

export const actions: Actions = {
	bid: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`bid:${uid}`, 20, 60_000);
			placeBid(getDb(), int(params.id), uid, int(f.get('amount')));
			return { bid: true };
		});
	},
	cancel: ({ locals, params }) =>
		run(locals, (uid) => {
			cancelAuction(getDb(), int(params.id), uid);
			return { cancelled: true };
		})
};
