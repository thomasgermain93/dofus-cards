import type { DB } from '../db';
import { PACK_INTERVAL_MS, PACK_MAX, PACK_ODDS, PACK_SIZE, XP } from './constants';
import { addXp, assert, grantCard, getUser, type CardRow } from './core';
import type { Rng } from './rng';

export interface PackState {
	stock: number;
	anchor: number;
	/** ms avant le prochain paquet (null si la réserve est pleine) */
	nextInMs: number | null;
}

/**
 * Calcule la réserve de paquets à l'instant `now` (fonction pure).
 * `anchor` = moment où la recharge en cours a commencé.
 */
export function computePacks(stock: number, anchor: number, now: number): PackState {
	if (stock >= PACK_MAX) return { stock: PACK_MAX, anchor: now, nextInMs: null };
	const elapsed = Math.max(0, now - anchor);
	const gained = Math.floor(elapsed / PACK_INTERVAL_MS);
	const newStock = Math.min(PACK_MAX, stock + gained);
	if (newStock >= PACK_MAX) return { stock: PACK_MAX, anchor: now, nextInMs: null };
	const newAnchor = anchor + gained * PACK_INTERVAL_MS;
	return { stock: newStock, anchor: newAnchor, nextInMs: newAnchor + PACK_INTERVAL_MS - now };
}

export function getPackState(db: DB, userId: number, now = Date.now()): PackState {
	const u = getUser(db, userId);
	return computePacks(u.pack_stock, u.pack_anchor, now);
}

/** Tire une rareté selon PACK_ODDS. `minRarity` sert à garantir la dernière carte. */
export function drawRarity(rng: Rng, minRarity = 0): number {
	const odds = PACK_ODDS.map((p, i) => (i < minRarity ? 0 : p));
	const total = odds.reduce((a, b) => a + b, 0);
	let x = rng() * total;
	for (let i = 0; i < odds.length; i++) {
		x -= odds[i];
		if (x < 0) return i;
	}
	return odds.length - 1;
}

/** Tire les cartes d'un paquet : 5 cartes, la dernière au moins Peu commune. Triées de la moins à la plus rare. */
export function drawPack(db: DB, rng: Rng): CardRow[] {
	const counts = db.prepare('SELECT rarity, COUNT(*) n FROM cards WHERE active = 1 GROUP BY rarity').all() as {
		rarity: number;
		n: number;
	}[];
	const available = new Map(counts.map((c) => [c.rarity, c.n]));
	const byOffset = db.prepare('SELECT * FROM cards WHERE active = 1 AND rarity = ? ORDER BY id LIMIT 1 OFFSET ?');
	const out: CardRow[] = [];
	for (let i = 0; i < PACK_SIZE; i++) {
		let r = drawRarity(rng, i === PACK_SIZE - 1 ? 1 : 0);
		// Outil de démo hors production : forcer la rareté de la dernière carte (captures d'écran)
		if (i === PACK_SIZE - 1 && process.env.NODE_ENV !== 'production' && process.env.DEV_PACK_LAST_RARITY) r = Number(process.env.DEV_PACK_LAST_RARITY);
		while (r > 0 && !available.get(r)) r--; // rareté vide (dataset de test) : on descend
		const n = available.get(r) ?? 0;
		assert(n > 0, 'Aucune carte disponible.');
		out.push(byOffset.get(r, Math.floor(rng() * n)) as CardRow);
	}
	return out.sort((a, b) => a.rarity - b.rarity || a.attack - b.attack);
}

/** Ajoute des paquets à la réserve (récompense quotidienne...), sans dépasser la limite. */
export function givePacks(db: DB, userId: number, n: number, now = Date.now()) {
	const s = getPackState(db, userId, now);
	const stock = Math.min(PACK_MAX, s.stock + n);
	db.prepare('UPDATE users SET pack_stock = ?, pack_anchor = ? WHERE id = ?').run(
		stock,
		stock >= PACK_MAX ? now : s.anchor,
		userId
	);
}

/** Ouvre un paquet : consomme 1 paquet de la réserve et donne 5 cartes (transaction atomique). */
export function openPack(db: DB, userId: number, rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		const s = getPackState(db, userId, now);
		assert(s.stock > 0, 'Aucun paquet disponible pour le moment.');
		// Si la réserve était pleine, la recharge démarre maintenant.
		const anchor = s.stock >= PACK_MAX ? now : s.anchor;
		db.prepare('UPDATE users SET pack_stock = ?, pack_anchor = ? WHERE id = ?').run(s.stock - 1, anchor, userId);
		const cards = drawPack(db, rng);
		const result = cards.map((c) => ({ card: c, isNew: grantCard(db, userId, c.id, now).isNew }));
		addXp(db, userId, XP.pack);
		db.prepare('INSERT INTO pack_openings (user_id, card_ids, created_at) VALUES (?, ?, ?)').run(
			userId,
			JSON.stringify(cards.map((c) => c.id)),
			now
		);
		return result;
	})();
}
