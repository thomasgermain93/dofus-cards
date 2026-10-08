import { describe, it, expect } from 'vitest';
import { computePacks, drawRarity, openPack, givePacks, getPackState } from '../game/packs';
import { PACK_INTERVAL_MS as P, PACK_MAX, PACK_ODDS, PACK_SIZE } from '../game/constants';
import { seededRng } from '../game/rng';
import { testDb, addUser } from './fixtures';
import { discardDuplicates, claimDaily } from '../game/collection';
import { kamas, give, copies } from './fixtures';
import { DISCARD_VALUES } from '../game/constants';

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

describe('défausse et récompense quotidienne', () => {
	it('défausser un doublon rapporte des kamas selon la rareté et garde 1 exemplaire', () => {
		const db = testDb();
		const u = addUser(db, 'e', 0);
		const card = db.prepare('SELECT id, rarity FROM cards WHERE rarity = 3 LIMIT 1').get() as { id: number; rarity: number };
		give(db, u, card.id, 3);
		expect(discardDuplicates(db, u, card.id, 2).gain).toBe(2 * DISCARD_VALUES[3]);
		expect(kamas(db, u)).toBe(2 * DISCARD_VALUES[3]);
		expect(copies(db, u, card.id)).toBe(1);
		expect(() => discardDuplicates(db, u, card.id, 1)).toThrow(/doublons/);
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
