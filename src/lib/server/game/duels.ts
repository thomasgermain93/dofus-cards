import type { DB } from '../db';
import {
	DUEL_BOT_ACCURACY,
	DUEL_DECK_SIZE,
	DUEL_MAX_PER_DAY,
	DUEL_QUESTIONS_PER_CARD,
	DUEL_WIN_POINTS,
	XP
} from './constants';
import { addXp, assert, getCard, getUser, notify, ownsCard, parseIds, type CardRow } from './core';
import { questionsForCard } from './quiz';
import type { Rng } from './rng';

export const BOT_NAME = 'Ordinateur';

export interface DuelRow {
	id: number;
	challenger_id: number;
	opponent_id: number | null;
	vs_bot: number;
	challenger_cards: string;
	opponent_cards: string | null;
	status: string;
	challenger_hp: number | null;
	opponent_hp: number | null;
	challenger_max: number | null;
	opponent_max: number | null;
	winner_id: number | null;
	result: string | null;
	created_at: number;
	finished_at: number | null;
}

export function getDuel(db: DB, id: number): DuelRow {
	const d = db.prepare('SELECT * FROM duels WHERE id = ?').get(id) as DuelRow | undefined;
	assert(d, 'Duel introuvable.');
	return d;
}

function validateDeck(db: DB, userId: number, cardIds: number[]) {
	assert(cardIds.length === DUEL_DECK_SIZE, `Choisis exactement ${DUEL_DECK_SIZE} cartes.`);
	assert(new Set(cardIds).size === DUEL_DECK_SIZE, 'Choisis 3 cartes différentes.');
	for (const id of cardIds) assert(ownsCard(db, userId, id), 'Tu ne possèdes pas une des cartes choisies.');
}

function areFriends(db: DB, a: number, b: number) {
	return !!db
		.prepare(
			"SELECT 1 FROM friendships WHERE status = 'accepted' AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))"
		)
		.get(a, b, b, a);
}

/** Génère les questions que `answererId` devra résoudre sur les cartes adverses. */
function generateQuestions(db: DB, duelId: number, answererId: number | null, cardIds: number[], rng: Rng) {
	const ins = db.prepare(
		'INSERT INTO duel_questions (duel_id, answerer_id, card_id, position, prompt, choices, correct) VALUES (?, ?, ?, ?, ?, ?, ?)'
	);
	let pos = 0;
	for (const cardId of cardIds) {
		const card = getCard(db, cardId);
		for (const q of questionsForCard(db, card, rng, DUEL_QUESTIONS_PER_CARD)) {
			ins.run(duelId, answererId, cardId, pos++, q.prompt, JSON.stringify(q.choices), q.correct);
		}
	}
}

/** Deck de l'ordinateur : une carte de même rareté pour chaque carte du joueur. */
function botDeck(db: DB, playerCards: number[], rng: Rng): number[] {
	const out: number[] = [];
	for (const id of playerCards) {
		const { rarity } = getCard(db, id);
		const n = (db.prepare('SELECT COUNT(*) n FROM cards WHERE active = 1 AND rarity = ?').get(rarity) as { n: number }).n;
		let pick: number;
		do {
			pick = (
				db.prepare('SELECT id FROM cards WHERE active = 1 AND rarity = ? ORDER BY id LIMIT 1 OFFSET ?').get(rarity, Math.floor(rng() * n)) as {
					id: number;
				}
			).id;
		} while (out.includes(pick) && n > DUEL_DECK_SIZE);
		out.push(pick);
	}
	return out;
}

/** Lance un duel : contre un ami (en attente de son accord) ou contre l'ordinateur (immédiat). */
export function createDuel(db: DB, challengerId: number, opponentId: number | null, cardIds: number[], rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		validateDeck(db, challengerId, cardIds);
		const today = (
			db.prepare('SELECT COUNT(*) n FROM duels WHERE challenger_id = ? AND created_at > ?').get(challengerId, now - 86_400_000) as {
				n: number;
			}
		).n;
		assert(today < DUEL_MAX_PER_DAY, `Maximum ${DUEL_MAX_PER_DAY} duels lancés par 24 h.`);
		if (opponentId == null) {
			const bot = botDeck(db, cardIds, rng);
			const r = db
				.prepare(
					"INSERT INTO duels (challenger_id, opponent_id, vs_bot, challenger_cards, opponent_cards, status, created_at) VALUES (?, NULL, 1, ?, ?, 'active', ?)"
				)
				.run(challengerId, JSON.stringify(cardIds), JSON.stringify(bot), now);
			const id = Number(r.lastInsertRowid);
			generateQuestions(db, id, challengerId, bot, rng);
			generateQuestions(db, id, null, cardIds, rng);
			// L'ordinateur répond tout de suite, avec une précision fixe.
			const qs = db.prepare('SELECT id, correct FROM duel_questions WHERE duel_id = ? AND answerer_id IS NULL').all(id) as {
				id: number;
				correct: number;
			}[];
			const upd = db.prepare('UPDATE duel_questions SET answer = ?, answered_at = ? WHERE id = ?');
			for (const q of qs) upd.run(rng() < DUEL_BOT_ACCURACY ? q.correct : (q.correct + 1 + Math.floor(rng() * 3)) % 4, now, q.id);
			return id;
		}
		assert(opponentId !== challengerId, 'Tu ne peux pas te défier toi-même.');
		const opp = getUser(db, opponentId);
		assert(!opp.banned, 'Ce joueur ne peut pas être défié.');
		assert(areFriends(db, challengerId, opponentId), 'Tu ne peux défier que tes amis.');
		const r = db
			.prepare('INSERT INTO duels (challenger_id, opponent_id, challenger_cards, created_at) VALUES (?, ?, ?, ?)')
			.run(challengerId, opponentId, JSON.stringify(cardIds), now);
		const id = Number(r.lastInsertRowid);
		notify(db, opponentId, 'duel', `${getUser(db, challengerId).username} te défie en duel !`, `/duels/${id}`, now);
		return id;
	})();
}

export function acceptDuel(db: DB, duelId: number, userId: number, cardIds: number[], rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		const d = getDuel(db, duelId);
		assert(d.opponent_id === userId && d.status === 'pending', 'Ce duel n’est plus en attente.');
		validateDeck(db, userId, cardIds);
		db.prepare("UPDATE duels SET opponent_cards = ?, status = 'active' WHERE id = ?").run(JSON.stringify(cardIds), duelId);
		generateQuestions(db, duelId, d.challenger_id, cardIds, rng);
		generateQuestions(db, duelId, userId, parseIds(d.challenger_cards), rng);
		notify(db, d.challenger_id, 'duel', `${getUser(db, userId).username} a accepté ton duel. À toi de répondre !`, `/duels/${duelId}`, now);
	})();
}

export function declineDuel(db: DB, duelId: number, userId: number, now = Date.now()) {
	const d = getDuel(db, duelId);
	assert(d.status === 'pending' && (d.opponent_id === userId || d.challenger_id === userId), 'Ce duel n’est plus en attente.');
	const status = d.opponent_id === userId ? 'declined' : 'cancelled';
	db.prepare('UPDATE duels SET status = ?, finished_at = ? WHERE id = ?').run(status, now, duelId);
	if (status === 'declined') notify(db, d.challenger_id, 'duel', `${getUser(db, userId).username} a refusé ton duel.`, `/duels/${duelId}`, now);
}

export interface PublicQuestion {
	id: number;
	cardId: number;
	position: number;
	total: number;
	prompt: string;
	choices: string[];
}

/** Prochaine question sans réponse pour ce joueur (sans la bonne réponse !). */
export function nextQuestion(db: DB, duelId: number, userId: number): PublicQuestion | null {
	const total = (db.prepare('SELECT COUNT(*) n FROM duel_questions WHERE duel_id = ? AND answerer_id = ?').get(duelId, userId) as { n: number }).n;
	const q = db
		.prepare('SELECT id, card_id, position, prompt, choices FROM duel_questions WHERE duel_id = ? AND answerer_id = ? AND answer IS NULL ORDER BY position LIMIT 1')
		.get(duelId, userId) as { id: number; card_id: number; position: number; prompt: string; choices: string } | undefined;
	if (!q) return null;
	return { id: q.id, cardId: q.card_id, position: q.position, total, prompt: q.prompt, choices: JSON.parse(q.choices) };
}

/** Enregistre une réponse. Renvoie si elle était juste et la bonne réponse. */
export function answerQuestion(db: DB, duelId: number, userId: number, questionId: number, choice: number, now = Date.now()) {
	return db.transaction(() => {
		const d = getDuel(db, duelId);
		assert(d.status === 'active', 'Ce duel n’est pas en cours.');
		const q = db.prepare('SELECT * FROM duel_questions WHERE id = ? AND duel_id = ?').get(questionId, duelId) as
			| { answerer_id: number | null; answer: number | null; correct: number }
			| undefined;
		assert(q && q.answerer_id === userId, 'Question introuvable.');
		assert(q.answer == null, 'Tu as déjà répondu à cette question.');
		assert(Number.isInteger(choice) && choice >= 0 && choice < 4, 'Réponse invalide.');
		db.prepare('UPDATE duel_questions SET answer = ?, answered_at = ? WHERE id = ?').run(choice, now, questionId);
		const remaining = (db.prepare('SELECT COUNT(*) n FROM duel_questions WHERE duel_id = ? AND answer IS NULL').get(duelId) as { n: number }).n;
		let finished = false;
		if (remaining === 0) {
			finalizeDuel(db, duelId, now);
			finished = true;
		}
		return { correct: choice === q.correct, correctIndex: q.correct, finished };
	})();
}

export interface CardDamage {
	card: CardRow;
	wrong: number;
	total: number;
	damage: number;
}

/**
 * Calcul des dégâts : chaque carte attaque une fois.
 * dégâts = ATK de la carte x (mauvaises réponses de l'adversaire / questions sur cette carte).
 * PV de départ = somme des DEF des 3 cartes.
 */
export function computeDuel(db: DB, d: DuelRow) {
	const side = (cardsJson: string | null, answerer: number | null) => {
		const ids = parseIds(cardsJson);
		const cards = ids.map((id) => getCard(db, id));
		const attacks: CardDamage[] = cards.map((card) => {
			const rows = db
				.prepare(
					`SELECT answer, correct FROM duel_questions WHERE duel_id = ? AND card_id = ? AND ${answerer == null ? 'answerer_id IS NULL' : 'answerer_id = ?'}`
				)
				.all(...(answerer == null ? [d.id, card.id] : [d.id, card.id, answerer])) as { answer: number | null; correct: number }[];
			const total = rows.length;
			const wrong = rows.filter((r) => r.answer != null && r.answer !== r.correct).length;
			return { card, wrong, total, damage: total ? Math.round((card.attack * wrong) / total) : 0 };
		});
		return { cards, attacks, maxHp: cards.reduce((s, c) => s + c.defense, 0) };
	};
	// Les cartes du challenger sont questionnées à l'adversaire (ou à l'ordinateur), et inversement.
	const ch = side(d.challenger_cards, d.vs_bot ? null : d.opponent_id);
	const op = side(d.opponent_cards, d.challenger_id);
	const chHp = Math.max(0, ch.maxHp - op.attacks.reduce((s, a) => s + a.damage, 0));
	const opHp = Math.max(0, op.maxHp - ch.attacks.reduce((s, a) => s + a.damage, 0));
	return { challenger: { ...ch, hp: chHp }, opponent: { ...op, hp: opHp } };
}

/** Vainqueur : PV à 0 = KO, sinon meilleur ratio PV restants / PV max. */
export function decideWinner(chHp: number, chMax: number, opHp: number, opMax: number): 'challenger' | 'opponent' | 'draw' {
	const a = chMax ? chHp / chMax : 0;
	const b = opMax ? opHp / opMax : 0;
	if (Math.abs(a - b) < 1e-9) return 'draw';
	return a > b ? 'challenger' : 'opponent';
}

export function finalizeDuel(db: DB, duelId: number, now = Date.now()) {
	const d = getDuel(db, duelId);
	if (d.status !== 'active') return;
	const r = computeDuel(db, d);
	const result = decideWinner(r.challenger.hp, r.challenger.maxHp, r.opponent.hp, r.opponent.maxHp);
	const winnerId = result === 'challenger' ? d.challenger_id : result === 'opponent' ? d.opponent_id : null;
	db.prepare(
		"UPDATE duels SET status = 'done', challenger_hp = ?, opponent_hp = ?, challenger_max = ?, opponent_max = ?, result = ?, winner_id = ?, finished_at = ? WHERE id = ?"
	).run(r.challenger.hp, r.opponent.hp, r.challenger.maxHp, r.opponent.maxHp, result, winnerId, now, duelId);
	const humans = [d.challenger_id, ...(d.vs_bot ? [] : [d.opponent_id!])];
	for (const uid of humans) {
		const won = uid === winnerId;
		addXp(db, uid, result === 'draw' ? XP.duelDraw : won ? XP.duelWin : XP.duelLoss);
		if (won) {
			// Les victoires contre l'ordinateur rapportent moins (évite le farm du classement).
			db.prepare('INSERT INTO score_events (user_id, kind, points, created_at) VALUES (?, ?, ?, ?)').run(
				uid,
				'duel',
				d.vs_bot ? Math.round(DUEL_WIN_POINTS / 5) : DUEL_WIN_POINTS,
				now
			);
		}
		if (!d.vs_bot) {
			const text = result === 'draw' ? 'Match nul' : won ? 'Victoire' : 'Défaite';
			notify(db, uid, 'duel', `Duel terminé : ${text} !`, `/duels/${duelId}`, now);
		}
	}
}
