import type { DB } from '../db';
import { XP } from './constants';
import { addKamas, addXp, assert, freeCopies, getUser, moveCopy, notify, parseIds } from './core';
import { track } from './quests';
import { assertNotBlocked, awardWishGift } from './profile';

export interface TradeRow {
	id: number;
	from_id: number;
	to_id: number;
	offer_cards: string;
	offer_kamas: number;
	request_cards: string;
	message: string | null;
	status: string;
	created_at: number;
	resolved_at: number | null;
}

const MAX_CARDS = 6;

function countBy(ids: number[]) {
	const m = new Map<number, number>();
	for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
	return m;
}

function checkHas(db: DB, userId: number, ids: number[], who: string) {
	for (const [cardId, n] of countBy(ids)) {
		assert(freeCopies(db, userId, cardId).length >= n, `${who} ne possède plus toutes les cartes de l'échange.`);
	}
}

/** Propose un échange : cartes (+ kamas) contre cartes. */
export function createTrade(
	db: DB,
	fromId: number,
	toId: number,
	offerCards: number[],
	offerKamas: number,
	requestCards: number[],
	message: string | null,
	now = Date.now(),
	parentId: number | null = null
) {
	return db.transaction(() => {
		assert(fromId !== toId, 'Tu ne peux pas échanger avec toi-même.');
		assertNotBlocked(db, fromId, toId);
		const to = getUser(db, toId);
		assert(!to.banned, 'Ce joueur ne peut pas recevoir de proposition.');
		assert(Number.isInteger(offerKamas) && offerKamas >= 0, 'Montant invalide.');
		assert(offerCards.length <= MAX_CARDS && requestCards.length <= MAX_CARDS, `${MAX_CARDS} cartes maximum de chaque côté.`);
		assert(offerCards.length + offerKamas > 0, 'Propose au moins une carte ou des kamas.');
		// Pas de carte demandée = cadeau (au moins une carte offerte)
		checkHas(db, fromId, offerCards, 'Tu');
		checkHas(db, toId, requestCards, 'Ce joueur');
		assert(getUser(db, fromId).kamas >= offerKamas, 'Pas assez de kamas.');
		if (!requestCards.length) assert(offerCards.length > 0, 'Un cadeau doit contenir au moins une carte.');
		if (parentId) {
			const parent = getTrade(db, parentId);
			assert(parent.to_id === fromId && parent.from_id === toId && parent.status === 'pending', 'Contre-proposition impossible.');
			db.prepare("UPDATE trades SET status = 'countered', resolved_at = ? WHERE id = ?").run(now, parentId);
		}
		const r = db
			.prepare(
				'INSERT INTO trades (from_id, to_id, offer_cards, offer_kamas, request_cards, message, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
			)
			.run(fromId, toId, JSON.stringify(offerCards), offerKamas, JSON.stringify(requestCards), message, now, parentId);
		const id = Number(r.lastInsertRowid);
		const who = getUser(db, fromId).username;
		notify(db, toId, 'trade', parentId ? `${who} te fait une contre-proposition.` : requestCards.length ? `${who} te propose un échange.` : `${who} t'offre un cadeau !`, `/trades/${id}`, now);
		return id;
	})();
}

function getTrade(db: DB, id: number) {
	const t = db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as TradeRow | undefined;
	assert(t, 'Échange introuvable.');
	return t;
}

/**
 * Accepte un échange : tout est vérifié puis transféré dans une seule
 * transaction SQLite (soit tout passe, soit rien ne bouge).
 */
export function acceptTrade(db: DB, tradeId: number, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const t = getTrade(db, tradeId);
		assert(t.to_id === userId, 'Échange introuvable.');
		assert(t.status === 'pending', 'Cet échange n’est plus en attente.');
		const offer = parseIds(t.offer_cards);
		const request = parseIds(t.request_cards);
		checkHas(db, t.from_id, offer, 'L’autre joueur');
		checkHas(db, t.to_id, request, 'Tu');
		// Points de guilde si la carte reçue était souhaitée (calculés avant le transfert, qui retire le souhait)
		const rarityOf = (id: number) => (db.prepare('SELECT rarity FROM cards WHERE id = ?').get(id) as { rarity: number }).rarity;
		for (const cardId of new Set(offer)) awardWishGift(db, t.from_id, t.to_id, cardId, rarityOf(cardId), now);
		for (const cardId of new Set(request)) awardWishGift(db, t.to_id, t.from_id, cardId, rarityOf(cardId), now);
		for (const [cardId, n] of countBy(offer)) {
			for (const copy of freeCopies(db, t.from_id, cardId).slice(-n)) moveCopy(db, copy, t.to_id, now);
		}
		for (const [cardId, n] of countBy(request)) {
			for (const copy of freeCopies(db, t.to_id, cardId).slice(-n)) moveCopy(db, copy, t.from_id, now);
		}
		if (t.offer_kamas > 0) {
			addKamas(db, t.from_id, -t.offer_kamas, `trade:${tradeId}`, now);
			addKamas(db, t.to_id, t.offer_kamas, `trade:${tradeId}`, now);
		}
		addXp(db, t.from_id, XP.trade);
		addXp(db, t.to_id, XP.trade);
		track(db, t.from_id, 'trade', 1, now);
		track(db, t.to_id, 'trade', 1, now);
		db.prepare("UPDATE trades SET status = 'accepted', resolved_at = ? WHERE id = ?").run(now, tradeId);
		notify(db, t.from_id, 'trade', `${getUser(db, userId).username} a accepté ton échange !`, `/trades/${tradeId}`, now);
	})();
}

export function declineTrade(db: DB, tradeId: number, userId: number, now = Date.now()) {
	const t = getTrade(db, tradeId);
	assert(t.to_id === userId && t.status === 'pending', 'Échange introuvable.');
	db.prepare("UPDATE trades SET status = 'declined', resolved_at = ? WHERE id = ?").run(now, tradeId);
	notify(db, t.from_id, 'trade', `${getUser(db, userId).username} a refusé ton échange.`, `/trades/${tradeId}`, now);
}

export function cancelTrade(db: DB, tradeId: number, userId: number, now = Date.now()) {
	const t = getTrade(db, tradeId);
	assert(t.from_id === userId && t.status === 'pending', 'Échange introuvable.');
	db.prepare("UPDATE trades SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(now, tradeId);
}
