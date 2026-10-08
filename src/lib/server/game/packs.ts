import type { DB } from '../db';
import { BOOSTERS, PACK_INTERVAL_MS, PACK_MAX, PACK_ODDS, PACK_SIZE, SHINY_CHANCE, XP, type BoosterKind } from './constants';
import { track } from './quests';
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

/** Tire une rareté selon PACK_ODDS. `minRarity` sert à garantir la dernière carte, `boost` multiplie les chances Rare+. */
export function drawRarity(rng: Rng, minRarity = 0, boost = 1): number {
	const odds = PACK_ODDS.map((p, i) => (i < minRarity ? 0 : i >= 2 ? p * boost : p));
	const total = odds.reduce((a, b) => a + b, 0);
	let x = rng() * total;
	for (let i = 0; i < odds.length; i++) {
		x -= odds[i];
		if (x < 0) return i;
	}
	return odds.length - 1;
}

/** Tire les cartes d'un paquet : 5 cartes, la dernière au moins Peu commune (plus pour les boosters bonus). Triées de la moins à la plus rare. */
export function drawPack(db: DB, rng: Rng, opts: { minLast?: number; boost?: number } = {}): CardRow[] {
	const counts = db.prepare('SELECT rarity, COUNT(*) n FROM cards WHERE active = 1 GROUP BY rarity').all() as {
		rarity: number;
		n: number;
	}[];
	const available = new Map(counts.map((c) => [c.rarity, c.n]));
	const byOffset = db.prepare('SELECT * FROM cards WHERE active = 1 AND rarity = ? ORDER BY id LIMIT 1 OFFSET ?');
	const out: CardRow[] = [];
	for (let i = 0; i < PACK_SIZE; i++) {
		let r = drawRarity(rng, i === PACK_SIZE - 1 ? (opts.minLast ?? 1) : 0, opts.boost ?? 1);
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

export type PackSource = 'free' | BoosterKind;

/**
 * Ouvre un paquet : paquet gratuit de la réserve, ou booster bonus (Bronze / Argent / Or).
 * Transaction atomique : consommation, tirage, cartes brillantes, quêtes.
 */
export function openPack(db: DB, userId: number, rng: Rng, now = Date.now(), source: PackSource = 'free') {
	return db.transaction(() => {
		let opts: { minLast?: number; boost?: number } = {};
		let forceShiny = false;
		if (source === 'free') {
			const s = getPackState(db, userId, now);
			assert(s.stock > 0, 'Aucun paquet disponible pour le moment.');
			// Si la réserve était pleine, la recharge démarre maintenant.
			const anchor = s.stock >= PACK_MAX ? now : s.anchor;
			db.prepare('UPDATE users SET pack_stock = ?, pack_anchor = ? WHERE id = ?').run(s.stock - 1, anchor, userId);
		} else {
			const b = BOOSTERS[source];
			assert(b, 'Booster inconnu.');
			const r = db.prepare('UPDATE boosters SET qty = qty - 1 WHERE user_id = ? AND kind = ? AND qty > 0').run(userId, source);
			assert(r.changes === 1, `Tu n'as pas de ${b.name}.`);
			opts = { minLast: b.minLast, boost: b.boost };
			forceShiny = b.shiny;
		}
		const cards = drawPack(db, rng, opts);
		const shinyIdx = forceShiny ? cards.length - 1 : -1;
		const result = cards.map((c, i) => {
			const shiny = i === shinyIdx || rng() < SHINY_CHANCE;
			return { card: c, shiny, isNew: grantCard(db, userId, c.id, now, true, shiny).isNew };
		});
		addXp(db, userId, XP.pack);
		db.prepare('INSERT INTO pack_openings (user_id, card_ids, created_at) VALUES (?, ?, ?)').run(
			userId,
			JSON.stringify(cards.map((c) => c.id)),
			now
		);
		track(db, userId, 'pack', 1, now);
		track(db, userId, 'new_card', result.filter((r) => r.isNew).length, now);
		track(db, userId, 'rare_card', result.filter((r) => r.card.rarity >= 2).length, now);
		track(db, userId, 'monster_card', result.filter((r) => r.card.category === 'monster').length, now);
		return result;
	})();
}

export function boosterCounts(db: DB, userId: number): Record<BoosterKind, number> {
	const rows = db.prepare('SELECT kind, qty FROM boosters WHERE user_id = ?').all(userId) as { kind: BoosterKind; qty: number }[];
	const out = { bronze: 0, silver: 0, gold: 0 };
	for (const r of rows) out[r.kind] = r.qty;
	return out;
}
