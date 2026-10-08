import { describe, it, expect } from 'vitest';
import { brusselsDay, brusselsWeek, nextBrusselsMidnight, dayDiff } from '../game/time';
import { nextStreak, calendarDay, claimDaily, chestStatus, claimChest } from '../game/retention';
import { ensureQuests, listQuests, track, claimQuest, pickQuests, DAILY_POOL } from '../game/quests';
import { craftCard, sellCards } from '../game/collection';
import { allCollections, claimCollection, userCollections } from '../game/collections';
import { openPack, boosterCounts } from '../game/packs';
import { addBooster } from '../game/quests';
import { CRAFT_COSTS, RECYCLE_VALUES, SELL_VALUES, SHINY_VALUE_MULT, DAILY_CALENDAR } from '../game/constants';
import { seededRng } from '../game/rng';
import { testDb, addUser, give, kamas, copies } from './fixtures';

const H = 3_600_000;
const D = 24 * H;
const frag = (db: ReturnType<typeof testDb>, id: number) => (db.prepare('SELECT fragments FROM users WHERE id = ?').get(id) as { fragments: number }).fragments;

describe('minuit à Bruxelles', () => {
	it('le jour change à minuit heure de Bruxelles (été et hiver)', () => {
		// été (UTC+2) : 22:30 UTC = 00:30 le lendemain à Bruxelles
		expect(brusselsDay(Date.UTC(2026, 6, 14, 21, 59))).toBe('2026-07-14');
		expect(brusselsDay(Date.UTC(2026, 6, 14, 22, 0))).toBe('2026-07-15');
		// hiver (UTC+1)
		expect(brusselsDay(Date.UTC(2026, 0, 14, 22, 59))).toBe('2026-01-14');
		expect(brusselsDay(Date.UTC(2026, 0, 14, 23, 0))).toBe('2026-01-15');
	});
	it('prochain minuit et semaine commençant le lundi', () => {
		expect(nextBrusselsMidnight(Date.UTC(2026, 6, 14, 10))).toBe(Date.UTC(2026, 6, 14, 22));
		expect(nextBrusselsMidnight(Date.UTC(2026, 0, 14, 10))).toBe(Date.UTC(2026, 0, 14, 23));
		expect(brusselsWeek(Date.UTC(2026, 9, 8, 12))).toBe('2026-10-05');
		expect(brusselsWeek(Date.UTC(2026, 9, 11, 21, 59))).toBe('2026-10-05'); // dimanche 23:59
		expect(brusselsWeek(Date.UTC(2026, 9, 11, 22, 1))).toBe('2026-10-12'); // lundi 00:01
		expect(dayDiff('2026-10-30', '2026-11-02')).toBe(3);
	});
});

describe('série de connexion', () => {
	it('règles : +1, joker hebdomadaire, rattrapage doux', () => {
		expect(nextStreak(null, 0, '2026-10-08', null, 'w').streak).toBe(1);
		expect(nextStreak('2026-10-07', 5, '2026-10-08', null, 'w').streak).toBe(6);
		const j = nextStreak('2026-10-06', 5, '2026-10-08', null, 'w');
		expect(j).toEqual({ streak: 6, jokerUsed: true });
		expect(nextStreak('2026-10-06', 5, '2026-10-08', 'w', 'w').streak).toBe(2); // joker déjà utilisé : moitié
		expect(nextStreak('2026-09-01', 12, '2026-10-08', null, 'w').streak).toBe(6);
		expect(nextStreak('2026-09-01', 1, '2026-10-08', null, 'w').streak).toBe(1);
		expect([1, 7, 8, 14, 15].map(calendarDay)).toEqual([1, 7, 1, 7, 1]);
	});
	it('calendrier sur 7 jours : récompenses croissantes et boosters', () => {
		const db = testDb();
		const u = addUser(db, 'a', 0);
		const t0 = Date.UTC(2026, 9, 5, 9);
		let total = 0;
		for (let d = 0; d < 7; d++) {
			const r = claimDaily(db, u, t0 + d * D);
			expect(r.day).toBe(d + 1);
			total += DAILY_CALENDAR[d].kamas;
		}
		expect(kamas(db, u)).toBe(total);
		expect(boosterCounts(db, u)).toEqual({ bronze: 1, silver: 1, gold: 1 });
		expect(claimDaily(db, u, t0 + 7 * D).day).toBe(1);
	});
});

describe('quêtes', () => {
	it('3 quêtes du jour et 3 de la semaine, tirage stable et sans doublon d’événement', () => {
		const a = pickQuests(DAILY_POOL, 3, 'x');
		expect(pickQuests(DAILY_POOL, 3, 'x')).toEqual(a);
		expect(new Set(a.map((q) => q.event)).size).toBe(3);
		const db = testDb();
		const u = addUser(db, 'q');
		const now = Date.UTC(2026, 9, 8, 12);
		ensureQuests(db, u, now);
		ensureQuests(db, u, now);
		const list = listQuests(db, u, now);
		expect(list.filter((q) => q.period === 'day')).toHaveLength(3);
		expect(list.filter((q) => q.period === 'week')).toHaveLength(3);
		expect(list.some((q) => q.code === 'w-quests-10')).toBe(true);
		// nouvelles quêtes après minuit à Bruxelles
		const tomorrow = listQuests(db, u, Date.UTC(2026, 9, 8, 22, 5));
		expect(tomorrow.find((q) => q.period === 'day')!.period_key).toBe('2026-10-09');
	});
	it('progression, récupération unique, quête expirée', () => {
		const db = testDb();
		const u = addUser(db, 'q', 0);
		const now = Date.UTC(2026, 9, 8, 12);
		const q = listQuests(db, u, now).find((x) => x.period === 'day')!;
		expect(() => claimQuest(db, u, q.id, now)).toThrow(/pas encore/);
		track(db, u, q.event, q.target + 5, now);
		const after = listQuests(db, u, now).find((x) => x.id === q.id)!;
		expect(after.progress).toBe(q.target);
		const r = claimQuest(db, u, q.id, now);
		expect(r.kamas).toBe(q.reward_kamas);
		expect(() => claimQuest(db, u, q.id, now)).toThrow(/déjà/);
		const weekly = listQuests(db, u, now).find((x) => x.code === 'w-quests-10')!;
		expect(weekly.progress).toBe(1);
		// une autre quête terminée mais récupérée le lendemain : expirée
		const q2 = listQuests(db, u, now).find((x) => x.period === 'day' && x.id !== q.id)!;
		track(db, u, q2.event, q2.target, now);
		expect(() => claimQuest(db, u, q2.id, now + D)).toThrow(/expiré/);
	});
	it('ouvrir un paquet fait avancer les quêtes de paquets', () => {
		const db = testDb();
		const u = addUser(db, 'p');
		const now = Date.UTC(2026, 9, 8, 12);
		ensureQuests(db, u, now);
		db.prepare("INSERT INTO quests (user_id, period, period_key, code, event, target) VALUES (?, 'day', ?, 'test-pack', 'pack', 3)").run(u, brusselsDay(now));
		openPack(db, u, seededRng(1), now);
		const q = db.prepare("SELECT progress FROM quests WHERE user_id = ? AND code = 'test-pack'").get(u) as { progress: number };
		expect(q.progress).toBe(1);
	});
});

describe('coffre de la semaine', () => {
	it('se remplit avec les quêtes et s’ouvre la semaine suivante', () => {
		const db = testDb();
		const u = addUser(db, 'c', 0);
		const mon = Date.UTC(2026, 9, 5, 10);
		for (let d = 0; d < 2; d++) {
			const now = mon + d * D;
			for (const q of listQuests(db, u, now).filter((x) => x.period === 'day')) {
				track(db, u, q.event, q.target, now);
				claimQuest(db, u, q.id, now);
			}
		}
		const st = chestStatus(db, u, mon + 2 * D);
		expect(st.current.count).toBe(6);
		expect(st.current.tier?.tier).toBe('bronze');
		expect(() => claimChest(db, u, mon + 2 * D)).toThrow(/Pas de coffre/);
		const next = mon + 7 * D;
		const before = kamas(db, u);
		expect(claimChest(db, u, next).tier).toBe('bronze');
		expect(kamas(db, u)).toBeGreaterThan(before);
		expect(() => claimChest(db, u, next)).toThrow(/déjà/);
	});
});

describe('fabrication et brillantes', () => {
	it('recycler donne des fragments, fabriquer coûte selon la rareté', () => {
		const db = testDb();
		const u = addUser(db, 'f', 0);
		const card = db.prepare('SELECT id FROM cards WHERE rarity = 2 LIMIT 1').get() as { id: number };
		give(db, u, card.id, 3);
		expect(sellCards(db, u, [{ cardId: card.id, count: 2 }], null, 0, 'recycle').gain).toBe(2 * RECYCLE_VALUES[2]);
		expect(frag(db, u)).toBe(2 * RECYCLE_VALUES[2]);
		expect(kamas(db, u)).toBe(0);
		const target = db.prepare('SELECT id FROM cards WHERE rarity = 3 LIMIT 1').get() as { id: number };
		expect(() => craftCard(db, u, target.id)).toThrow(/fragments/);
		db.prepare('UPDATE users SET fragments = ? WHERE id = ?').run(CRAFT_COSTS[3] + 5, u);
		expect(craftCard(db, u, target.id).cost).toBe(CRAFT_COSTS[3]);
		expect(copies(db, u, target.id)).toBe(1);
		expect(frag(db, u)).toBe(5);
	});
	it('une brillante vaut plus et n’est vendue qu’en dernier', () => {
		const db = testDb();
		const u = addUser(db, 's', 0);
		const card = db.prepare('SELECT id FROM cards WHERE rarity = 3 LIMIT 1').get() as { id: number };
		db.prepare('INSERT INTO user_cards (user_id, card_id, obtained_at, shiny) VALUES (?, ?, 0, 1)').run(u, card.id);
		give(db, u, card.id, 1);
		expect(sellCards(db, u, [{ cardId: card.id, count: 1 }]).gain).toBe(SELL_VALUES[3]);
		expect((db.prepare('SELECT shiny FROM user_cards WHERE user_id = ?').get(u) as { shiny: number }).shiny).toBe(1);
		expect(sellCards(db, u, [{ cardId: card.id, count: 1 }]).gain).toBe(SELL_VALUES[3] * SHINY_VALUE_MULT);
	});
	it('booster Or : dernière carte Ultra rare ou mieux et brillante garantie', () => {
		const db = testDb();
		const u = addUser(db, 'g');
		addBooster(db, u, 'gold', 2);
		const r = openPack(db, u, seededRng(3), 0, 'gold');
		expect(r[r.length - 1].card.rarity).toBeGreaterThanOrEqual(4);
		expect(r.some((x) => x.shiny)).toBe(true);
		expect(boosterCounts(db, u).gold).toBe(1);
		expect(() => openPack(db, u, seededRng(3), 0, 'silver')).toThrow(/pas de/);
	});
});

describe('collections', () => {
	it('récompense seulement quand la collection est complète, une seule fois', () => {
		const db = testDb();
		const u = addUser(db, 'k', 0);
		// collections de test : panoplies (4 panoplies réparties sur les objets de la base de test)
		const set = allCollections(db).find((c) => c.kind === 'panoplie')!;
		expect(set).toBeTruthy();
		give(db, u, set.cardIds[0]);
		expect(() => claimCollection(db, u, set.key, seededRng(1))).toThrow(/manque/);
		for (const id of set.cardIds.slice(1)) give(db, u, id);
		expect(userCollections(db, u).find((c) => c.key === set.key)!.complete).toBe(true);
		const r = claimCollection(db, u, set.key, seededRng(1));
		expect(kamas(db, u)).toBe(r.kamas);
		expect((db.prepare('SELECT COUNT(*) n FROM user_cards WHERE user_id = ? AND shiny = 1').get(u) as { n: number }).n).toBe(1);
		expect(() => claimCollection(db, u, set.key, seededRng(1))).toThrow(/déjà/);
	});
});
