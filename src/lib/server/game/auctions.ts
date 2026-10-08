import type { DB } from '../db';
import { AUCTION_DURATIONS_H, AUCTION_MAX_OPEN, AUCTION_MIN_INCREMENT, XP } from './constants';
import { addKamas, addXp, assert, freeCopies, getCard, moveCopy, notify } from './core';
import { track } from './quests';

export interface AuctionRow {
	id: number;
	seller_id: number;
	user_card_id: number;
	card_id: number;
	start_price: number;
	current_bid: number | null;
	bidder_id: number | null;
	bid_count: number;
	status: string;
	ends_at: number;
	created_at: number;
}

export function minNextBid(a: Pick<AuctionRow, 'current_bid' | 'start_price'>) {
	if (a.current_bid == null) return a.start_price;
	return a.current_bid + Math.max(1, Math.ceil(a.current_bid * AUCTION_MIN_INCREMENT));
}

/** Met un exemplaire en vente. La carte est bloquée jusqu'à la clôture. */
export function createAuction(db: DB, sellerId: number, cardId: number, startPrice: number, durationH: number, now = Date.now()) {
	return db.transaction(() => {
		assert(Number.isInteger(startPrice) && startPrice >= 1 && startPrice <= 10_000_000, 'Prix de départ invalide.');
		assert(AUCTION_DURATIONS_H.includes(durationH), 'Durée invalide.');
		const open = (
			db.prepare("SELECT COUNT(*) n FROM auctions WHERE seller_id = ? AND status = 'open'").get(sellerId) as { n: number }
		).n;
		assert(open < AUCTION_MAX_OPEN, `Maximum ${AUCTION_MAX_OPEN} ventes en cours.`);
		getCard(db, cardId);
		const copies = freeCopies(db, sellerId, cardId);
		assert(copies.length > 0, 'Tu ne possèdes pas cette carte (ou elle est déjà en vente).');
		const copy = copies[copies.length - 1];
		db.prepare("UPDATE user_cards SET locked = 'auction' WHERE id = ?").run(copy);
		const r = db
			.prepare(
				'INSERT INTO auctions (seller_id, user_card_id, card_id, start_price, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(sellerId, copy, cardId, startPrice, now + durationH * 3_600_000, now);
		return Number(r.lastInsertRowid);
	})();
}

/**
 * Enchérit : les kamas de l'enchérisseur sont réservés tout de suite et le
 * précédent meilleur enchérisseur est remboursé.
 */
export function placeBid(db: DB, auctionId: number, bidderId: number, amount: number, now = Date.now()) {
	return db.transaction(() => {
		const a = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId) as AuctionRow | undefined;
		assert(a, 'Enchère introuvable.');
		assert(a.status === 'open' && a.ends_at > now, 'Cette enchère est terminée.');
		assert(a.seller_id !== bidderId, 'Tu ne peux pas enchérir sur ta propre vente.');
		assert(a.bidder_id !== bidderId, 'Tu es déjà le meilleur enchérisseur.');
		assert(Number.isInteger(amount), 'Montant invalide.');
		const min = minNextBid(a);
		assert(amount >= min, `L'enchère minimale est de ${min} kamas.`);
		addKamas(db, bidderId, -amount, `bid:${auctionId}`, now);
		if (a.bidder_id != null && a.current_bid != null) {
			addKamas(db, a.bidder_id, a.current_bid, `refund:${auctionId}`, now);
			const card = getCard(db, a.card_id);
			notify(db, a.bidder_id, 'auction', `Ton enchère sur ${card.name} a été dépassée.`, `/market/${auctionId}`, now);
		}
		// Anti-sniping : une enchère dans les 2 dernières minutes prolonge de 2 minutes.
		const endsAt = a.ends_at - now < 120_000 ? now + 120_000 : a.ends_at;
		db.prepare('UPDATE auctions SET current_bid = ?, bidder_id = ?, bid_count = bid_count + 1, ends_at = ? WHERE id = ?').run(
			amount,
			bidderId,
			endsAt,
			auctionId
		);
		db.prepare('INSERT INTO bids (auction_id, user_id, amount, created_at) VALUES (?, ?, ?, ?)').run(
			auctionId,
			bidderId,
			amount,
			now
		);
		track(db, bidderId, 'bid', 1, now);
	})();
}

/** Annule une vente sans enchère (le vendeur récupère sa carte). */
export function cancelAuction(db: DB, auctionId: number, sellerId: number) {
	return db.transaction(() => {
		const a = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId) as AuctionRow | undefined;
		assert(a && a.seller_id === sellerId, 'Enchère introuvable.');
		assert(a.status === 'open', 'Cette enchère est terminée.');
		assert(a.bid_count === 0, 'Impossible d’annuler : il y a déjà des enchères.');
		db.prepare("UPDATE auctions SET status = 'cancelled' WHERE id = ?").run(auctionId);
		db.prepare('UPDATE user_cards SET locked = NULL WHERE id = ?').run(a.user_card_id);
	})();
}

/** Clôture une enchère échue (appelée par la tâche planifiée). */
export function settleAuction(db: DB, auctionId: number, now = Date.now()) {
	return db.transaction(() => {
		const a = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId) as AuctionRow | undefined;
		if (!a || a.status !== 'open' || a.ends_at > now) return null;
		const card = getCard(db, a.card_id);
		if (a.bidder_id != null && a.current_bid != null) {
			moveCopy(db, a.user_card_id, a.bidder_id, now);
			addKamas(db, a.seller_id, a.current_bid, `sale:${auctionId}`, now);
			addXp(db, a.seller_id, XP.auctionSold);
			db.prepare("UPDATE auctions SET status = 'sold' WHERE id = ?").run(auctionId);
			notify(db, a.seller_id, 'auction', `${card.name} vendue ${a.current_bid} kamas.`, `/market/${auctionId}`, now);
			notify(db, a.bidder_id, 'auction', `Tu as remporté ${card.name} pour ${a.current_bid} kamas !`, `/card/${card.id}`, now);
			return 'sold';
		}
		db.prepare('UPDATE user_cards SET locked = NULL WHERE id = ?').run(a.user_card_id);
		db.prepare("UPDATE auctions SET status = 'unsold' WHERE id = ?").run(auctionId);
		notify(db, a.seller_id, 'auction', `Personne n'a enchéri sur ${card.name}. La carte revient dans ton album.`, `/album`, now);
		return 'unsold';
	})();
}

export function settleExpiredAuctions(db: DB, now = Date.now()) {
	const ids = db.prepare("SELECT id FROM auctions WHERE status = 'open' AND ends_at <= ?").all(now) as { id: number }[];
	let n = 0;
	for (const { id } of ids) if (settleAuction(db, id, now)) n++;
	return n;
}
