import type { DB } from '../db';
import { addKamas, addXp, assert, getCard, notify, ownsCard, parseIds } from './core';
import { questionsForCard } from './quiz';
import { shuffle, type Rng } from './rng';

/**
 * Bataille de groupe : un salon par code (3 à 50 joueurs), chacun amène 3 cartes,
 * tout le monde répond aux mêmes questions en 15 s. Le déroulé est entièrement
 * calculé à partir de l'heure du serveur (aucun état côté client : reconnexion
 * transparente, un joueur qui quitte ne bloque rien).
 */

export const BATTLE_MIN_PLAYERS = 3;
export const BATTLE_MAX_PLAYERS = 50;
export const BATTLE_CARDS = 3;
export const BATTLE_MAX_QUESTIONS = 12;
export const QUESTION_MS = 15_000;
export const REVEAL_MS = 4_000;
export const COUNTDOWN_MS = 4_000;
export const BATTLE_REWARDS = [150, 100, 60]; // kamas pour le podium, 20 pour les autres participants
export const BATTLE_PARTICIPATION = 20;

export interface BattleRow {
	id: number;
	code: string;
	host_id: number;
	status: 'lobby' | 'running' | 'done' | 'cancelled';
	question_count: number;
	started_at: number | null;
	finished_at: number | null;
	created_at: number;
}

export type Phase =
	| { kind: 'lobby' }
	| { kind: 'countdown'; endsAt: number }
	| { kind: 'question'; index: number; endsAt: number }
	| { kind: 'reveal'; index: number; endsAt: number }
	| { kind: 'done' };

/** Phase de la partie à l'instant `now` (fonction pure). */
export function battlePhase(status: string, startedAt: number | null, count: number, now: number): Phase {
	if (status === 'lobby' || startedAt == null) return { kind: 'lobby' };
	if (status === 'done' || status === 'cancelled') return { kind: 'done' };
	if (now < startedAt) return { kind: 'countdown', endsAt: startedAt };
	const slot = QUESTION_MS + REVEAL_MS;
	const index = Math.floor((now - startedAt) / slot);
	if (index >= count) return { kind: 'done' };
	const t = (now - startedAt) % slot;
	const qStart = startedAt + index * slot;
	return t < QUESTION_MS ? { kind: 'question', index, endsAt: qStart + QUESTION_MS } : { kind: 'reveal', index, endsAt: qStart + slot };
}

/**
 * Barème : 10 points pour une bonne réponse, 20 si moins de la moitié des joueurs l'a trouvée,
 * 30 si moins de 10 % l'ont trouvée.
 */
export function questionPoints(correctCount: number, players: number) {
	if (players <= 0 || correctCount <= 0) return 0;
	const ratio = correctCount / players;
	if (ratio < 0.1) return 30;
	if (ratio < 0.5) return 20;
	return 10;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function getBattle(db: DB, code: string): BattleRow {
	const b = db.prepare('SELECT * FROM battles WHERE code = ?').get(code.toUpperCase().trim()) as BattleRow | undefined;
	assert(b, 'Aucune bataille avec ce code.');
	return b;
}

export function createBattle(db: DB, hostId: number, rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		const today = (db.prepare("SELECT COUNT(*) n FROM battles WHERE host_id = ? AND created_at > ?").get(hostId, now - 86_400_000) as { n: number }).n;
		assert(today < 10, 'Maximum 10 batailles créées par 24 h.');
		let code = '';
		do {
			code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)]).join('');
		} while (db.prepare('SELECT 1 FROM battles WHERE code = ?').get(code));
		const r = db.prepare('INSERT INTO battles (code, host_id, created_at) VALUES (?, ?, ?)').run(code, hostId, now);
		db.prepare('INSERT INTO battle_players (battle_id, user_id, joined_at) VALUES (?, ?, ?)').run(Number(r.lastInsertRowid), hostId, now);
		return code;
	})();
}

export function joinBattle(db: DB, code: string, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const b = getBattle(db, code);
		const existing = db.prepare('SELECT left_at FROM battle_players WHERE battle_id = ? AND user_id = ?').get(b.id, userId) as { left_at: number | null } | undefined;
		if (existing) {
			// Reconnexion : on revient dans la partie
			if (existing.left_at && b.status === 'lobby') db.prepare('UPDATE battle_players SET left_at = NULL WHERE battle_id = ? AND user_id = ?').run(b.id, userId);
			return b;
		}
		assert(b.status === 'lobby', 'La partie a déjà commencé.');
		const n = (db.prepare('SELECT COUNT(*) n FROM battle_players WHERE battle_id = ? AND left_at IS NULL').get(b.id) as { n: number }).n;
		assert(n < BATTLE_MAX_PLAYERS, 'Le salon est complet.');
		db.prepare('INSERT INTO battle_players (battle_id, user_id, joined_at) VALUES (?, ?, ?)').run(b.id, userId, now);
		return b;
	})();
}

export function setBattleCards(db: DB, code: string, userId: number, cardIds: number[]) {
	const b = getBattle(db, code);
	assert(b.status === 'lobby', 'La partie a déjà commencé.');
	assert(db.prepare('SELECT 1 FROM battle_players WHERE battle_id = ? AND user_id = ? AND left_at IS NULL').get(b.id, userId), 'Rejoins d’abord le salon.');
	assert(cardIds.length === BATTLE_CARDS && new Set(cardIds).size === BATTLE_CARDS, `Choisis ${BATTLE_CARDS} cartes différentes.`);
	for (const id of cardIds) assert(ownsCard(db, userId, id), 'Tu ne possèdes pas une des cartes choisies.');
	db.prepare('UPDATE battle_players SET cards = ? WHERE battle_id = ? AND user_id = ?').run(JSON.stringify(cardIds), b.id, userId);
}

/** Quitter : dans le salon on est retiré (l'hôte passe la main) ; en partie on est marqué absent. */
export function leaveBattle(db: DB, code: string, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const b = getBattle(db, code);
		if (b.status === 'lobby') {
			db.prepare('DELETE FROM battle_players WHERE battle_id = ? AND user_id = ?').run(b.id, userId);
			const next = db.prepare('SELECT user_id FROM battle_players WHERE battle_id = ? ORDER BY joined_at LIMIT 1').get(b.id) as { user_id: number } | undefined;
			if (!next) db.prepare("UPDATE battles SET status = 'cancelled', finished_at = ? WHERE id = ?").run(now, b.id);
			else if (b.host_id === userId) db.prepare('UPDATE battles SET host_id = ? WHERE id = ?').run(next.user_id, b.id);
		} else {
			db.prepare('UPDATE battle_players SET left_at = ? WHERE battle_id = ? AND user_id = ?').run(now, b.id, userId);
		}
	})();
}

export function startBattle(db: DB, code: string, userId: number, rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		const b = getBattle(db, code);
		assert(b.host_id === userId, 'Seul l’hôte peut lancer la partie.');
		assert(b.status === 'lobby', 'La partie a déjà commencé.');
		const players = db.prepare('SELECT user_id, cards FROM battle_players WHERE battle_id = ? AND left_at IS NULL').all(b.id) as { user_id: number; cards: string }[];
		const ready = players.filter((p) => parseIds(p.cards).length === BATTLE_CARDS);
		assert(ready.length >= BATTLE_MIN_PLAYERS, `Il faut au moins ${BATTLE_MIN_PLAYERS} joueurs avec leurs 3 cartes.`);
		// Les joueurs sans cartes sont retirés du salon
		for (const p of players) if (!ready.includes(p)) db.prepare('DELETE FROM battle_players WHERE battle_id = ? AND user_id = ?').run(b.id, p.user_id);
		const pool = shuffle(
			ready.flatMap((p) => parseIds(p.cards).map((cardId) => ({ cardId, owner: p.user_id }))),
			rng
		);
		const seen = new Set<number>();
		const picked = pool.filter((x) => (seen.has(x.cardId) ? false : (seen.add(x.cardId), true))).slice(0, BATTLE_MAX_QUESTIONS);
		const ins = db.prepare('INSERT INTO battle_questions (battle_id, idx, card_id, owner_id, prompt, choices, correct) VALUES (?, ?, ?, ?, ?, ?, ?)');
		picked.forEach((x, idx) => {
			const [q] = questionsForCard(db, getCard(db, x.cardId), rng, 1);
			ins.run(b.id, idx, x.cardId, x.owner, q.prompt, JSON.stringify(q.choices), q.correct);
		});
		db.prepare("UPDATE battles SET status = 'running', question_count = ?, started_at = ? WHERE id = ?").run(picked.length, now + COUNTDOWN_MS, b.id);
		for (const p of ready) if (p.user_id !== userId) notify(db, p.user_id, 'battle', 'La bataille de groupe commence !', `/battle/${b.code}`, now);
	})();
}

export function answerBattle(db: DB, code: string, userId: number, index: number, choice: number, now = Date.now()) {
	return db.transaction(() => {
		const b = getBattle(db, code);
		const ph = battlePhase(b.status, b.started_at, b.question_count, now);
		assert(ph.kind === 'question' && ph.index === index, 'Trop tard pour cette question.');
		assert(Number.isInteger(choice) && choice >= 0 && choice < 4, 'Réponse invalide.');
		assert(db.prepare('SELECT 1 FROM battle_players WHERE battle_id = ? AND user_id = ?').get(b.id, userId), 'Tu ne participes pas à cette bataille.');
		const q = db.prepare('SELECT id FROM battle_questions WHERE battle_id = ? AND idx = ?').get(b.id, index) as { id: number };
		const r = db.prepare('INSERT OR IGNORE INTO battle_answers (question_id, user_id, choice, answered_at) VALUES (?, ?, ?, ?)').run(q.id, userId, choice, now);
		assert(r.changes === 1, 'Tu as déjà répondu.');
	})();
}

/** Scores des questions terminées (le propriétaire d'une carte ne marque pas sur sa propre carte). */
export function battleScores(db: DB, b: BattleRow, now = Date.now()) {
	const players = db
		.prepare('SELECT bp.user_id, u.username, bp.left_at, bp.cards FROM battle_players bp JOIN users u ON u.id = bp.user_id WHERE bp.battle_id = ?')
		.all(b.id) as { user_id: number; username: string; left_at: number | null; cards: string }[];
	const scores = new Map(players.map((p) => [p.user_id, 0]));
	const correctCounts = new Map(players.map((p) => [p.user_id, 0]));
	const ph = battlePhase(b.status, b.started_at, b.question_count, now);
	const finished = ph.kind === 'done' ? b.question_count : ph.kind === 'reveal' ? ph.index + 1 : ph.kind === 'question' ? ph.index : 0;
	const qs = db.prepare('SELECT id, idx, correct, owner_id FROM battle_questions WHERE battle_id = ? AND idx < ? ORDER BY idx').all(b.id, finished) as {
		id: number;
		idx: number;
		correct: number;
		owner_id: number | null;
	}[];
	for (const q of qs) {
		const answers = db.prepare('SELECT user_id, choice FROM battle_answers WHERE question_id = ?').all(q.id) as { user_id: number; choice: number }[];
		const eligible = players.filter((p) => p.user_id !== q.owner_id).length;
		const right = answers.filter((a) => a.choice === q.correct && a.user_id !== q.owner_id);
		const pts = questionPoints(right.length, eligible);
		for (const a of right) {
			scores.set(a.user_id, (scores.get(a.user_id) ?? 0) + pts);
			correctCounts.set(a.user_id, (correctCounts.get(a.user_id) ?? 0) + 1);
		}
	}
	return players
		.map((p) => ({ userId: p.user_id, username: p.username, left: !!p.left_at, score: scores.get(p.user_id) ?? 0, correct: correctCounts.get(p.user_id) ?? 0 }))
		.sort((a, b2) => b2.score - a.score || b2.correct - a.correct || a.username.localeCompare(b2.username));
}

/** Clôture (idempotente) : classement final et récompenses. */
export function finalizeBattle(db: DB, code: string, now = Date.now()) {
	return db.transaction(() => {
		const b = getBattle(db, code);
		if (b.status !== 'running') return false;
		if (battlePhase(b.status, b.started_at, b.question_count, now).kind !== 'done') return false;
		const ranking = battleScores(db, b, now);
		const upd = db.prepare('UPDATE battle_players SET score = ?, rank = ? WHERE battle_id = ? AND user_id = ?');
		ranking.forEach((r, i) => {
			upd.run(r.score, i + 1, b.id, r.userId);
			const reward = i < BATTLE_REWARDS.length && r.score > 0 ? BATTLE_REWARDS[i] : BATTLE_PARTICIPATION;
			addKamas(db, r.userId, reward, `battle:${b.code}`, now);
			addXp(db, r.userId, i === 0 ? 40 : 15);
		});
		db.prepare("UPDATE battles SET status = 'done', finished_at = ? WHERE id = ?").run(now, b.id);
		return true;
	})();
}

/** Clôture des batailles terminées (tâche planifiée). */
export function finalizeDueBattles(db: DB, now = Date.now()) {
	const rows = db.prepare("SELECT code FROM battles WHERE status = 'running'").all() as { code: string }[];
	let n = 0;
	for (const r of rows) if (finalizeBattle(db, r.code, now)) n++;
	// Salons abandonnés depuis plus de 6 h
	db.prepare("UPDATE battles SET status = 'cancelled', finished_at = ? WHERE status = 'lobby' AND created_at < ?").run(now, now - 6 * 3_600_000);
	return n;
}

/** État complet vu par un joueur (sans jamais révéler la bonne réponse avant la fin de la question). */
export function battleState(db: DB, code: string, userId: number, now = Date.now()) {
	finalizeBattle(db, code, now);
	const b = getBattle(db, code);
	const ph = battlePhase(b.status, b.started_at, b.question_count, now);
	const players = db
		.prepare(
			`SELECT bp.user_id, u.username, bp.cards, bp.left_at, bp.rank, bp.score, c.image avatar, u.avatar_x, u.avatar_y
			 FROM battle_players bp JOIN users u ON u.id = bp.user_id LEFT JOIN cards c ON c.id = u.avatar_card_id
			 WHERE bp.battle_id = ? ORDER BY bp.joined_at`
		)
		.all(b.id) as { user_id: number; username: string; cards: string; left_at: number | null; rank: number | null; score: number; avatar: string | null; avatar_x: number; avatar_y: number }[];
	const me = players.find((p) => p.user_id === userId);
	let question = null;
	if (ph.kind === 'question' || ph.kind === 'reveal') {
		const q = db.prepare('SELECT * FROM battle_questions WHERE battle_id = ? AND idx = ?').get(b.id, ph.index) as {
			id: number;
			card_id: number;
			owner_id: number | null;
			prompt: string;
			choices: string;
			correct: number;
		};
		const card = getCard(db, q.card_id);
		const mine = db.prepare('SELECT choice FROM battle_answers WHERE question_id = ? AND user_id = ?').get(q.id, userId) as { choice: number } | undefined;
		const answered = (db.prepare('SELECT COUNT(*) n FROM battle_answers WHERE question_id = ?').get(q.id) as { n: number }).n;
		const counts =
			ph.kind === 'reveal'
				? [0, 1, 2, 3].map((i) => (db.prepare('SELECT COUNT(*) n FROM battle_answers WHERE question_id = ? AND choice = ?').get(q.id, i) as { n: number }).n)
				: null;
		question = {
			index: ph.index,
			total: b.question_count,
			prompt: q.prompt,
			choices: JSON.parse(q.choices) as string[],
			card: { id: card.id, name: card.name, image: card.image, category: card.category, subtype: card.subtype, level: card.level, rarity: card.rarity, attack: card.attack, defense: card.defense, info1: card.info1, info2: card.info2, flavor: card.flavor },
			owner: players.find((p) => p.user_id === q.owner_id)?.username ?? null,
			isMine: q.owner_id === userId,
			myAnswer: mine?.choice ?? null,
			answered,
			correct: ph.kind === 'reveal' ? q.correct : null,
			counts
		};
	}
	const scores = ph.kind === 'lobby' ? [] : battleScores(db, b, now);
	return {
		code: b.code,
		status: b.status,
		hostId: b.host_id,
		isHost: b.host_id === userId,
		joined: !!me && !me.left_at,
		myCards: me ? parseIds(me.cards) : [],
		phase: ph,
		question,
		players: players.map((p) => ({
			userId: p.user_id,
			username: p.username,
			ready: parseIds(p.cards).length === BATTLE_CARDS,
			left: !!p.left_at,
			avatar: p.avatar,
			avatarX: p.avatar_x,
			avatarY: p.avatar_y,
			rank: p.rank
		})),
		scores,
		serverNow: now,
		rules: { min: BATTLE_MIN_PLAYERS, max: BATTLE_MAX_PLAYERS, questionMs: QUESTION_MS, revealMs: REVEAL_MS, rewards: BATTLE_REWARDS, participation: BATTLE_PARTICIPATION }
	};
}

export function battleHistory(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT b.code, b.status, b.created_at, b.finished_at, bp.rank, bp.score,
				(SELECT COUNT(*) FROM battle_players x WHERE x.battle_id = b.id) players
			 FROM battle_players bp JOIN battles b ON b.id = bp.battle_id WHERE bp.user_id = ? ORDER BY b.id DESC LIMIT 20`
		)
		.all(userId) as { code: string; status: string; created_at: number; finished_at: number | null; rank: number | null; score: number; players: number }[];
}

