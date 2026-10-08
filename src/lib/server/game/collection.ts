import type { DB } from '../db';
import { CRAFT_COSTS, RECYCLE_VALUES, SELL_VALUES, SHINY_VALUE_MULT } from './constants';
import { addKamas, assert, freeCopies, getCard, getUser, grantCard, parseIds } from './core';
import { addFragments, track } from './quests';

export type DisposeMode = 'sell' | 'recycle';

export interface SellItem {
	cardId: number;
	count: number;
}

/** Exemplaires réservés par les échanges en attente proposés par ce joueur. */
function reservedByTrades(db: DB, userId: number): Map<number, number> {
	const rows = db.prepare("SELECT offer_cards FROM trades WHERE from_id = ? AND status = 'pending'").all(userId) as { offer_cards: string }[];
	const m = new Map<number, number>();
	for (const r of rows) for (const id of parseIds(r.offer_cards)) m.set(id, (m.get(id) ?? 0) + 1);
	return m;
}

/**
 * Exemplaires vendables d'une carte : possédés, hors enchère en cours et hors
 * échanges proposés en attente. Le dernier exemplaire est vendable.
 */
export function sellableIds(db: DB, userId: number, cardId: number, reserved = reservedByTrades(db, userId)): number[] {
	const free = freeCopies(db, userId, cardId);
	return free.slice(0, Math.max(0, free.length - (reserved.get(cardId) ?? 0)));
}

export function sellableCounts(db: DB, userId: number, cardIds: number[]): Map<number, number> {
	const reserved = reservedByTrades(db, userId);
	return new Map(cardIds.map((id) => [id, sellableIds(db, userId, id, reserved).length]));
}

/**
 * Vente rapide au jeu (contre des kamas). Tout ou rien : si une quantité n'est
 * pas disponible, rien n'est vendu. `nonce` (facultatif) rend l'appel idempotent :
 * un double clic renvoie le résultat de la première vente sans revendre.
 */
export function sellCards(db: DB, userId: number, items: SellItem[], nonce: string | null = null, now = Date.now(), mode: DisposeMode = 'sell') {
	return db.transaction(() => {
		assert(Array.isArray(items) && items.length > 0 && items.length <= 200, 'Aucune carte à vendre.');
		const reason = nonce ? `${mode}:${nonce}` : null;
		if (reason) {
			const prev = db.prepare('SELECT delta FROM ledger WHERE user_id = ? AND reason = ?').get(userId, reason) as { delta: number } | undefined;
			if (prev) return { gain: prev.delta, cards: 0, duplicate: true, mode };
		}
		const merged = new Map<number, number>();
		for (const it of items) {
			assert(Number.isInteger(it?.cardId) && Number.isInteger(it?.count) && it.count > 0 && it.count <= 1000, 'Quantité invalide.');
			merged.set(it.cardId, (merged.get(it.cardId) ?? 0) + it.count);
		}
		const reserved = reservedByTrades(db, userId);
		const del = db.prepare('DELETE FROM user_cards WHERE id = ?');
		let gain = 0;
		let cards = 0;
		for (const [cardId, count] of merged) {
			const card = getCard(db, cardId);
			const ids = sellableIds(db, userId, cardId, reserved);
			assert(ids.length >= count, `Tu ne peux vendre que ${ids.length} exemplaire${ids.length > 1 ? 's' : ''} de ${card.name} (les cartes en vente ou proposées en échange sont bloquées).`);
			const base = (mode === 'sell' ? SELL_VALUES : RECYCLE_VALUES)[card.rarity];
			const isShiny = db.prepare('SELECT shiny FROM user_cards WHERE id = ?');
			for (const id of ids.slice(ids.length - count)) {
				const sh = (isShiny.get(id) as { shiny: number }).shiny;
				gain += base * (sh ? SHINY_VALUE_MULT : 1);
				del.run(id);
			}
			cards += count;
		}
		if (mode === 'sell') {
			addKamas(db, userId, gain, reason ?? `sell:${now}`, now);
		} else {
			addFragments(db, userId, gain);
			// trace dans le journal (delta = fragments) pour l'idempotence et l'historique
			db.prepare('INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').run(userId, gain, reason ?? `recycle:${now}`, now);
		}
		track(db, userId, mode === 'sell' ? 'sell' : 'recycle', cards, now);
		// Une carte vendue n'est plus favorite si on n'en a plus
		db.prepare('DELETE FROM favorites WHERE user_id = ? AND card_id NOT IN (SELECT card_id FROM user_cards WHERE user_id = ?)').run(userId, userId);
		return { gain, cards, duplicate: false, mode };
	})();
}

/** Vend tous les doublons (on garde 1 exemplaire de chaque carte), jusqu'à une rareté maximale. */
export function sellAllDuplicates(db: DB, userId: number, maxRarity: number, nonce: string | null = null, now = Date.now(), mode: DisposeMode = 'sell') {
	return db.transaction(() => {
		const rows = db
			.prepare(
				`SELECT uc.card_id, COUNT(*) n FROM user_cards uc JOIN cards c ON c.id = uc.card_id
				 WHERE uc.user_id = ? AND c.rarity <= ? GROUP BY uc.card_id HAVING n > 1`
			)
			.all(userId, maxRarity) as { card_id: number; n: number }[];
		const reserved = reservedByTrades(db, userId);
		const items: SellItem[] = [];
		for (const r of rows) {
			const count = Math.min(sellableIds(db, userId, r.card_id, reserved).length, r.n - 1);
			if (count > 0) items.push({ cardId: r.card_id, count });
		}
		if (!items.length) return { gain: 0, cards: 0, duplicate: false, mode };
		return sellCards(db, userId, items, nonce, now, mode);
	})();
}

/** Fabrique une carte précise contre des fragments (coût selon la rareté). */
export function craftCard(db: DB, userId: number, cardId: number, now = Date.now()) {
	return db.transaction(() => {
		const card = getCard(db, cardId);
		assert((card as unknown as { active?: number }).active !== 0, 'Cette carte ne peut pas être fabriquée.');
		const cost = CRAFT_COSTS[card.rarity];
		assert(getUser(db, userId).fragments >= cost, `Il te faut ${cost} fragments (tu en as ${getUser(db, userId).fragments}).`);
		addFragments(db, userId, -cost);
		const { isNew } = grantCard(db, userId, cardId, now, false);
		db.prepare('INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').run(userId, -cost, `craft:${cardId}`, now);
		track(db, userId, 'craft', 1, now);
		return { cost, isNew };
	})();
}
