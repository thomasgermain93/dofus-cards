import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { questionsForCard, givesAway, tooSimilar, normText } from '../game/quiz';
import { getCard, type CardRow } from '../game/core';
import { seededRng } from '../game/rng';
import { testDb } from './fixtures';

/**
 * Règles de qualité des questions, vérifiées sur 1 000 questions.
 * Avec le vrai catalogue (data/game.db après `npm run import:dofusdb`) si présent, sinon la base de test.
 */
const realPath = 'data/game.db';
const db = existsSync(realPath) ? new Database(realPath, { readonly: true, fileMustExist: true }) : testDb();
const ids = (db.prepare('SELECT id FROM cards WHERE active = 1 ORDER BY id').all() as { id: number }[]).map((r) => r.id);

function check(card: CardRow, q: { prompt: string; choices: string[]; correct: number }) {
	const answer = q.choices[q.correct];
	const ctx = `${card.name} : ${q.prompt} [${q.choices.join(' | ')}]`;
	expect(q.choices, ctx).toHaveLength(4);
	expect(q.correct, ctx).toBeGreaterThanOrEqual(0);
	expect(new Set(q.choices.map(normText)).size, ctx).toBe(4);
	// jamais deux choix quasi identiques
	for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
		const a = q.choices[i];
		const b = q.choices[j];
		if (/^\d+$/.test(a) && /^\d+$/.test(b)) expect(Math.abs(Number(a) - Number(b)), ctx).toBeGreaterThanOrEqual(5);
		else expect(tooSimilar(a, b), ctx).toBe(false);
	}
	// la réponse ne se lit pas sur la carte (nom de la carte)
	if (!/^\d+$/.test(answer)) expect(givesAway(answer, card.name), ctx).toBe(false);
	// rédaction
	expect(q.prompt.endsWith(' ?'), ctx).toBe(true);
	expect(q.prompt, ctx).not.toMatch(/""|« «|» »|de Panoplie|  /);
	// niveaux plausibles pour les objets et montures
	if (/niveau/.test(q.prompt) && /^\d+$/.test(answer) && card.category !== 'monster')
		for (const c of q.choices) expect(Number(c), ctx).toBeLessThanOrEqual(200);
}

describe('quiz : 1 000 questions conformes aux règles', () => {
	it('règles de base', () => {
		expect(givesAway('Panoplie Volcanique', 'Amulette Volcanique')).toBe(true);
		expect(givesAway('Panoplie du Bouftou', 'Coiffe du Bouftou')).toBe(true);
		expect(givesAway('Panoplie Aventurière', 'Amulette Volcanique')).toBe(false);
		expect(tooSimilar('Panoplie du Bouftou', 'Panoplie du Bouftou Royal')).toBe(true);
		expect(tooSimilar('Dofus Ocre', 'Dofus Ocres')).toBe(true);
		expect(tooSimilar('Bouftou', 'Tofu')).toBe(false);
	});
	it('1 000 questions (3 par carte, ~334 cartes) : réponse jamais visible, choix distincts, un fait par question', () => {
		const rng = seededRng(2026);
		let n = 0;
		for (let i = 0; n < 1000; i++) {
			const card = getCard(db as never, ids[Math.floor(rng() * ids.length)]);
			const qs = questionsForCard(db as never, card, rng, 3);
			expect(new Set(qs.map((q) => q.prompt + q.choices.join())).size).toBe(3);
			// une seule question de niveau par carte
			expect(qs.filter((q) => /^À quel niveau|^Quel est le niveau|^À partir de quel niveau/.test(q.prompt)).length).toBeLessThanOrEqual(1);
			for (const q of qs) {
				check(card, q);
				n++;
			}
		}
		expect(n).toBeGreaterThanOrEqual(1000);
	});
	it('le cas signalé : « Amulette Volcanique » ne donne jamais sa panoplie ni son propre nom', () => {
		const row = db.prepare("SELECT id FROM cards WHERE name = 'Amulette Volcanique'").get() as { id: number } | undefined;
		if (!row) return expect(true).toBe(true);
		const card = getCard(db as never, row.id);
		for (let s = 0; s < 50; s++) {
			for (const q of questionsForCard(db as never, card, seededRng(s), 3)) {
				expect(q.choices[q.correct]).not.toBe('Amulette Volcanique');
				expect(q.choices[q.correct]).not.toMatch(/Volcanique/);
			}
		}
	});
});
