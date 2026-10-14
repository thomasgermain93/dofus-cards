import { describe, it, expect } from 'vitest';
import { createDuel, acceptDuel, nextQuestion, answerQuestion, decideWinner, getDuel, computeDuel } from '../game/duels';
import { questionsForCard } from '../game/quiz';
import { getCard } from '../game/core';
import { seededRng } from '../game/rng';
import { testDb, addUser, give, befriend } from './fixtures';

describe('quiz', () => {
	it('génère 3 questions à 4 choix distincts avec une bonne réponse valide', () => {
		const db = testDb();
		const rng = seededRng(5);
		for (const id of [1, 6, 11, 16, 30, 55]) {
			const qs = questionsForCard(db, getCard(db, id), rng, 3);
			expect(qs).toHaveLength(3);
			for (const q of qs) {
				expect(q.choices).toHaveLength(4);
				expect(new Set(q.choices).size).toBe(4);
				expect(q.correct).toBeGreaterThanOrEqual(0);
				expect(q.correct).toBeLessThan(4);
			}
		}
	});
});

describe('calcul des duels', () => {
	it('vainqueur au ratio de PV restants', () => {
		expect(decideWinner(500, 1000, 400, 1000)).toBe('challenger');
		expect(decideWinner(0, 1000, 1, 5000)).toBe('opponent');
		expect(decideWinner(300, 600, 500, 1000)).toBe('draw');
	});

	function playAll(db: ReturnType<typeof testDb>, duelId: number, userId: number, right: boolean) {
		let q;
		let last;
		while ((q = nextQuestion(db, duelId, userId))) {
			const correct = (db.prepare('SELECT correct FROM duel_questions WHERE id = ?').get(q.id) as { correct: number }).correct;
			last = answerQuestion(db, duelId, userId, q.id, right ? correct : (correct + 1) % 4);
		}
		return last;
	}

	it('duel entre amis : PV = somme des DEF, dégâts = ATK x taux de mauvaises réponses', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		const b = addUser(db, 'b');
		[1, 2, 3].forEach((c) => give(db, a, c));
		[4, 5, 6].forEach((c) => give(db, b, c));
		expect(() => createDuel(db, a, b, [1, 2, 3], seededRng(1))).toThrow(/amis/);
		befriend(db, a, b);
		const id = createDuel(db, a, b, [1, 2, 3], seededRng(1));
		expect(nextQuestion(db, id, a)).toBeNull(); // pas encore accepté
		acceptDuel(db, id, b, [4, 5, 6], seededRng(2));
		expect(nextQuestion(db, id, a)?.total).toBe(9);
		// a répond juste à tout, b se trompe partout
		playAll(db, id, a, true);
		expect(getDuel(db, id).status).toBe('active');
		const res = playAll(db, id, b, false);
		expect(res?.finished).toBe(true);
		const d = getDuel(db, id);
		expect(d.status).toBe('done');
		const atkA = [1, 2, 3].reduce((s, c) => s + getCard(db, c).attack, 0);
		const defB = [4, 5, 6].reduce((s, c) => s + getCard(db, c).defense, 0);
		const defA = [1, 2, 3].reduce((s, c) => s + getCard(db, c).defense, 0);
		expect(d.opponent_max).toBe(defB);
		expect(d.opponent_hp).toBe(Math.max(0, defB - atkA));
		expect(d.challenger_hp).toBe(defA);
		expect(d.winner_id).toBe(a);
		expect(() => answerQuestion(db, id, a, 1, 0)).toThrow();
	});

	it('dégâts partiels proportionnels', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		[1, 2, 3].forEach((c) => give(db, a, c));
		const id = createDuel(db, a, null, [1, 2, 3], seededRng(9));
		const r = computeDuel(db, getDuel(db, id));
		for (const atk of r.challenger.attacks) {
			expect(atk.total).toBe(3);
			expect(atk.damage).toBe(Math.round((atk.card.attack * atk.wrong) / 3));
		}
	});

	it('duel contre l’ordinateur : terminé dès que le joueur a répondu', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		[10, 20, 30].forEach((c) => give(db, a, c));
		const id = createDuel(db, a, null, [10, 20, 30], seededRng(4));
		const res = playAll(db, id, a, true);
		expect(res?.finished).toBe(true);
		const d = getDuel(db, id);
		expect(d.status).toBe('done');
		expect(d.result).not.toBeNull();
		// adversaire ordinateur : mêmes raretés
		const bot = JSON.parse(d.opponent_cards!) as number[];
		expect(bot.map((c) => getCard(db, c).rarity)).toEqual([10, 20, 30].map((c) => getCard(db, c).rarity));
	});

	it('refuse un deck invalide', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		[1, 2].forEach((c) => give(db, a, c));
		expect(() => createDuel(db, a, null, [1, 2], seededRng(1))).toThrow(/3/);
		expect(() => createDuel(db, a, null, [1, 1, 2], seededRng(1))).toThrow(/différentes/);
		expect(() => createDuel(db, a, null, [1, 2, 3], seededRng(1))).toThrow(/possèdes/);
	});
});
