import { describe, it, expect } from 'vitest';
import { percentileRanks, rarityFromPercentile, finalStat, itemRawStats, monsterRawDefense } from '../cards/formulas';
import { isOffensive, isOffensiveName, censor, rateLimit } from '../moderation';
import { checkAchievements, weeklyLeaderboard, weekStart } from '../game/progress';
import { createGuild, joinGuild, leaveGuild, sendFriendRequest, acceptFriend, sendMessage } from '../game/social';
import { openPack } from '../game/packs';
import { seededRng } from '../game/rng';
import { testDb, addUser, kamas } from './fixtures';

describe('formules', () => {
	it('percentiles et pyramide de rareté', () => {
		expect(percentileRanks([10, 30, 20])).toEqual([0, 1, 0.5]);
		expect(percentileRanks([5, 5])).toEqual([0.5, 0.5]);
		const r = Array.from({ length: 1000 }, (_, i) => rarityFromPercentile(i / 999));
		const count = (k: number) => r.filter((x) => x === k).length;
		for (let k = 0; k < 5; k++) expect(count(k)).toBeGreaterThan(count(k + 1));
	});
	it('stats sur 10 000, arrondies à la dizaine', () => {
		expect(finalStat(0, 0)).toBe(1000);
		expect(finalStat(1, 5)).toBe(10000);
		expect(finalStat(0.5, 2) % 10).toBe(0);
	});
	it('malus d’objet retirés, résistances bornées', () => {
		const bonus = itemRawStats(100, [{ characteristic: 10, from: 50, to: 0, bonusType: 1 }]);
		const malus = itemRawStats(100, [{ characteristic: 10, from: 50, to: 0, bonusType: -1 }]);
		expect(bonus.atk).toBeGreaterThan(malus.atk);
		const g = { level: 1, lifePoints: 100, actionPoints: 6, strength: 0, intelligence: 0, chance: 0, agility: 0, reductionEarth: 500, reductionWater: 500, reductionFire: 500, reductionAir: 500, reductionNeutral: 500 };
		expect(monsterRawDefense(g)).toBe(180);
	});
});

describe('modération', () => {
	it('détecte les insultes, même déguisées, sans faux positifs courants', () => {
		expect(isOffensive('espèce de c0nnard')).toBe(true);
		expect(isOffensive('SALOOOPE')).toBe(true);
		expect(isOffensive('le Bouftou unique de la technique')).toBe(false);
		expect(isOffensiveName('xxHitlerxx')).toBe(true);
		expect(isOffensiveName('Unique_Dispute')).toBe(false);
		expect(censor('bonjour connard !')).toBe('bonjour ******* !');
	});
	it('limite de débit', () => {
		for (let i = 0; i < 5; i++) expect(rateLimit('t', 5, 1000, 0)).toBe(true);
		expect(rateLimit('t', 5, 1000, 0)).toBe(false);
		expect(rateLimit('t', 5, 1000, 400)).toBe(true);
	});
});

describe('progression et social', () => {
	it('succès débloqués une seule fois avec récompense', () => {
		const db = testDb();
		const u = addUser(db, 'a', 0);
		openPack(db, u, seededRng(1), 0);
		const got = checkAchievements(db, u, 0).map((a) => a.code);
		expect(got).toContain('first-pack');
		expect(kamas(db, u)).toBeGreaterThan(0);
		expect(checkAchievements(db, u, 0).map((a) => a.code)).not.toContain('first-pack');
	});
	it('classement hebdomadaire basé sur la semaine en cours', () => {
		const db = testDb();
		const u = addUser(db, 'a');
		const now = Date.UTC(2026, 9, 8, 12);
		openPack(db, u, seededRng(1), now);
		expect(weeklyLeaderboard(db, now)[0].username).toBe('a');
		expect(weeklyLeaderboard(db, now + 7 * 86_400_000)).toHaveLength(0);
		// lundi 5 octobre 2026, 00:00 à Bruxelles = dimanche 4 octobre 22:00 UTC (heure d'été)
		expect(weekStart(now)).toBe(Date.UTC(2026, 9, 4, 22));
	});
	it('amis, messages et guildes', () => {
		const db = testDb();
		const a = addUser(db, 'alice');
		const b = addUser(db, 'bruno');
		expect(() => sendMessage(db, a, b, 'salut')).toThrow(/amis/);
		sendFriendRequest(db, a, 'BRUNO');
		acceptFriend(db, b, a);
		sendMessage(db, a, b, 'salut connard');
		expect((db.prepare('SELECT body FROM messages').get() as { body: string }).body).toBe('salut *******');
		const g = createGuild(db, a, 'Les Bouftous', 'BFT', 'Bienvenue');
		expect(() => createGuild(db, b, 'Les Bouftous', 'BF2', '')).toThrow(/pris/);
		joinGuild(db, b, g);
		leaveGuild(db, a); // le chef part : bruno devient chef
		expect((db.prepare('SELECT leader_id FROM guilds WHERE id = ?').get(g) as { leader_id: number }).leader_id).toBe(b);
		leaveGuild(db, b); // guilde vide supprimée
		expect(db.prepare('SELECT 1 FROM guilds WHERE id = ?').get(g)).toBeUndefined();
	});
});
