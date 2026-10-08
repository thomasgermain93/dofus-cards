import { describe, it, expect } from 'vitest';
import { computePacks, drawRarity, openPack, givePacks, getPackState } from '../game/packs';
import { PACK_INTERVAL_MS as P, PACK_MAX, PACK_ODDS, PACK_SIZE } from '../game/constants';
import { seededRng } from '../game/rng';
import { testDb, addUser } from './fixtures';
import { sellCards, sellAllDuplicates, claimDaily } from '../game/collection';
import { createAuction } from '../game/auctions';
import { createTrade } from '../game/trades';
import { kamas, give, copies } from './fixtures';
import { SELL_VALUES } from '../game/constants';

describe('minuterie des paquets', () => {
	it('gagne 1 paquet toutes les 10 minutes', () => {
		expect(computePacks(0, 0, P - 1).stock).toBe(0);
		expect(computePacks(0, 0, P).stock).toBe(1);
		expect(computePacks(0, 0, 3 * P + 5).stock).toBe(3);
	});
	it('conserve le temps déjà écoulé vers le paquet suivant', () => {
		const s = computePacks(0, 0, 2 * P + 1000);
		expect(s.anchor).toBe(2 * P);
		expect(s.nextInMs).toBe(P - 1000);
	});
	it('plafonne la réserve à 10 et arrête la minuterie', () => {
		const s = computePacks(2, 0, 100 * P);
		expect(s.stock).toBe(PACK_MAX);
		expect(s.nextInMs).toBeNull();
	});
	it('ouvrir un paquet à réserve pleine relance la minuterie depuis maintenant', () => {
		const db = testDb();
		const u = addUser(db, 'alice');
		const now = 500 * P;
		expect(getPackState(db, u, now).stock).toBe(10);
		openPack(db, u, seededRng(1), now);
		const s = getPackState(db, u, now + P - 1);
		expect(s.stock).toBe(9);
		expect(getPackState(db, u, now + P).stock).toBe(10);
	});
	it('refuse l’ouverture sans paquet', () => {
		const db = testDb();
		const u = addUser(db, 'bob');
		const rng = seededRng(2);
		for (let i = 0; i < 3; i++) openPack(db, u, rng, 1);
		expect(() => openPack(db, u, rng, 2)).toThrow(/Aucun paquet/);
	});
	it('ajout de paquets bonus plafonné', () => {
		const db = testDb();
		const u = addUser(db, 'c');
		givePacks(db, u, 50, 0);
		expect(getPackState(db, u, 0).stock).toBe(PACK_MAX);
	});
});

describe('tirages', () => {
	it('respecte les probabilités par rareté (±1 %)', () => {
		const rng = seededRng(42);
		const N = 200_000;
		const counts = new Array(6).fill(0);
		for (let i = 0; i < N; i++) counts[drawRarity(rng)]++;
		counts.forEach((c, r) => expect(Math.abs(c / N - PACK_ODDS[r])).toBeLessThan(0.01));
	});
	it('rareté minimale respectée', () => {
		const rng = seededRng(7);
		for (let i = 0; i < 5000; i++) expect(drawRarity(rng, 1)).toBeGreaterThanOrEqual(1);
	});
	it('un paquet = 5 cartes triées de la moins à la plus rare, dernière au moins Peu commune', () => {
		const db = testDb();
		const u = addUser(db, 'd');
		givePacks(db, u, 10, 0);
		const rng = seededRng(3);
		for (let k = 0; k < 10; k++) {
			const res = openPack(db, u, rng, 0);
			expect(res).toHaveLength(PACK_SIZE);
			const r = res.map((x) => x.card.rarity);
			expect([...r].sort((a, b) => a - b)).toEqual(r);
			expect(r[PACK_SIZE - 1]).toBeGreaterThanOrEqual(1);
		}
		const owned = (db.prepare('SELECT COUNT(*) n FROM user_cards WHERE user_id = ?').get(u) as { n: number }).n;
		expect(owned).toBe(10 * PACK_SIZE);
	});
});

describe('vente rapide et récompense quotidienne', () => {
	const pickCard = (db: ReturnType<typeof testDb>, rarity: number) =>
		db.prepare('SELECT id FROM cards WHERE rarity = ? LIMIT 1').get(rarity) as { id: number };

	it('vendre rapporte le barème de la rareté, y compris le dernier exemplaire', () => {
		const db = testDb();
		const u = addUser(db, 'e', 0);
		const card = pickCard(db, 3);
		give(db, u, card.id, 3);
		expect(sellCards(db, u, [{ cardId: card.id, count: 2 }]).gain).toBe(2 * SELL_VALUES[3]);
		expect(copies(db, u, card.id)).toBe(1);
		expect(sellCards(db, u, [{ cardId: card.id, count: 1 }]).gain).toBe(SELL_VALUES[3]);
		expect(copies(db, u, card.id)).toBe(0);
		expect(kamas(db, u)).toBe(3 * SELL_VALUES[3]);
		expect(() => sellCards(db, u, [{ cardId: card.id, count: 1 }])).toThrow(/que 0 exemplaire/);
	});
	it('une carte en enchère ou proposée en échange n’est pas vendable', () => {
		const db = testDb();
		const u = addUser(db, 'f', 100);
		const v = addUser(db, 'g', 0);
		const a = pickCard(db, 0).id;
		const b = pickCard(db, 1).id;
		give(db, u, a, 1);
		give(db, u, b, 2);
		give(db, v, 3, 1);
		createAuction(db, u, a, 10, 1, 0);
		expect(() => sellCards(db, u, [{ cardId: a, count: 1 }])).toThrow(/bloquées/);
		createTrade(db, u, v, [b], 0, [3], null, 0);
		expect(() => sellCards(db, u, [{ cardId: b, count: 2 }])).toThrow(/que 1 exemplaire/);
		expect(sellCards(db, u, [{ cardId: b, count: 1 }]).cards).toBe(1);
	});
	it('quantité invalide refusée, et rien n’est vendu si un lot échoue (tout ou rien)', () => {
		const db = testDb();
		const u = addUser(db, 'h', 0);
		const a = pickCard(db, 0).id;
		const b = pickCard(db, 2).id;
		give(db, u, a, 2);
		give(db, u, b, 1);
		for (const count of [0, -1, 1.5, NaN]) expect(() => sellCards(db, u, [{ cardId: a, count }])).toThrow(/Quantité invalide/);
		expect(() => sellCards(db, u, [])).toThrow(/Aucune carte/);
		expect(() => sellCards(db, u, [{ cardId: a, count: 1 }, { cardId: b, count: 2 }])).toThrow();
		expect(copies(db, u, a)).toBe(2);
		expect(kamas(db, u)).toBe(0);
	});
	it('double clic : le même identifiant de vente ne vend qu’une fois', () => {
		const db = testDb();
		const u = addUser(db, 'i', 0);
		const a = pickCard(db, 2).id;
		give(db, u, a, 5);
		const first = sellCards(db, u, [{ cardId: a, count: 1 }], 'nonce-1234');
		const second = sellCards(db, u, [{ cardId: a, count: 1 }], 'nonce-1234');
		expect(second.duplicate).toBe(true);
		expect(second.gain).toBe(first.gain);
		expect(copies(db, u, a)).toBe(4);
		expect(kamas(db, u)).toBe(SELL_VALUES[2]);
	});
	it('vendre tous les doublons garde un exemplaire et respecte la rareté maximale', () => {
		const db = testDb();
		const u = addUser(db, 'j', 0);
		const c = pickCard(db, 0).id;
		const r = pickCard(db, 4).id;
		give(db, u, c, 3);
		give(db, u, r, 2);
		const res = sellAllDuplicates(db, u, 2);
		expect(res.cards).toBe(2);
		expect(copies(db, u, c)).toBe(1);
		expect(copies(db, u, r)).toBe(2);
	});
	it('récompense quotidienne une fois par jour, série incrémentée', () => {
		const db = testDb();
		const u = addUser(db, 'f', 0);
		const day = 86_400_000;
		const a = claimDaily(db, u, 10 * day);
		expect(a.streak).toBe(1);
		expect(() => claimDaily(db, u, 10 * day + 1000)).toThrow(/déjà/);
		expect(claimDaily(db, u, 11 * day).streak).toBe(2);
		expect(claimDaily(db, u, 13 * day).streak).toBe(1);
	});
});
