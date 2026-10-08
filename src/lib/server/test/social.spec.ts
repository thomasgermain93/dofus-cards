import { describe, it, expect } from 'vitest';
import { battlePhase, questionPoints, createBattle, joinBattle, setBattleCards, startBattle, answerBattle, battleState, finalizeBattle, leaveBattle, getBattle, QUESTION_MS, REVEAL_MS, COUNTDOWN_MS, battleScores } from '../game/battle';
import { createTrade, acceptTrade } from '../game/trades';
import { saveShowcase, listShowcases, setMainShowcase, toggleWish, toggleBlock, reportUser, setAvatar } from '../game/profile';
import { createAuction } from '../game/auctions';
import { sendFriendRequest } from '../game/social';
import { createDuel, nextQuestion, answerQuestion, getDuel, rematch } from '../game/duels';
import { createGuild, joinGuild } from '../game/social';
import { guildLeaderboard } from '../game/progress';
import { seededRng } from '../game/rng';
import { testDb, addUser, give, copies, befriend } from './fixtures';

const SLOT = QUESTION_MS + REVEAL_MS;

describe('bataille de groupe', () => {
	it('phases calculées depuis l’heure du serveur', () => {
		expect(battlePhase('lobby', null, 5, 0).kind).toBe('lobby');
		expect(battlePhase('running', 1000, 3, 500)).toEqual({ kind: 'countdown', endsAt: 1000 });
		expect(battlePhase('running', 1000, 3, 1000)).toEqual({ kind: 'question', index: 0, endsAt: 1000 + QUESTION_MS });
		expect(battlePhase('running', 1000, 3, 1000 + QUESTION_MS).kind).toBe('reveal');
		expect(battlePhase('running', 1000, 3, 1000 + SLOT)).toMatchObject({ kind: 'question', index: 1 });
		expect(battlePhase('running', 1000, 3, 1000 + 3 * SLOT).kind).toBe('done');
	});
	it('barème : plus de points quand peu de joueurs trouvent', () => {
		expect(questionPoints(0, 10)).toBe(0);
		expect(questionPoints(8, 10)).toBe(10);
		expect(questionPoints(4, 10)).toBe(20);
		expect(questionPoints(1, 20)).toBe(30);
	});
	it('partie complète à 4 joueurs : salon, cartes, réponses, classement et récompenses', () => {
		const db = testDb();
		const ids = ['a', 'b', 'c', 'd'].map((n) => addUser(db, n, 0));
		ids.forEach((u, i) => [1, 2, 3].forEach((k) => give(db, u, i * 3 + k)));
		const rng = seededRng(7);
		const code = createBattle(db, ids[0], rng, 0);
		expect(code).toMatch(/^[A-Z2-9]{6}$/);
		for (const u of ids.slice(1)) joinBattle(db, code, u, 1);
		expect(() => startBattle(db, code, ids[0], rng, 2)).toThrow(/au moins 3/);
		ids.forEach((u, i) => setBattleCards(db, code, u, [i * 3 + 1, i * 3 + 2, i * 3 + 3]));
		expect(() => startBattle(db, code, ids[1], rng, 2)).toThrow(/hôte/);
		startBattle(db, code, ids[0], rng, 10);
		const b = getBattle(db, code);
		expect(b.question_count).toBe(12);
		const t0 = 10 + COUNTDOWN_MS;
		expect(() => joinBattle(db, code, addUser(db, 'late'), t0)).toThrow(/commencé/);
		// Question 0 : seul le joueur ids[1] répond juste (si ce n'est pas sa carte)
		const q0 = db.prepare('SELECT correct, owner_id FROM battle_questions WHERE battle_id = ? AND idx = 0').get(b.id) as { correct: number; owner_id: number };
		const responders = ids.filter((u) => u !== q0.owner_id);
		answerBattle(db, code, responders[0], 0, q0.correct, t0 + 100);
		answerBattle(db, code, responders[1], 0, (q0.correct + 1) % 4, t0 + 200);
		expect(() => answerBattle(db, code, responders[0], 0, q0.correct, t0 + 300)).toThrow(/déjà/);
		expect(() => answerBattle(db, code, responders[2], 1, 0, t0 + 300)).toThrow(/Trop tard/);
		// La bonne réponse n'est pas révélée pendant la question
		expect(battleState(db, code, responders[0], t0 + 500).question?.correct).toBeNull();
		const reveal = battleState(db, code, responders[0], t0 + QUESTION_MS + 10);
		expect(reveal.question?.correct).toBe(q0.correct);
		expect(reveal.scores[0].userId).toBe(responders[0]);
		expect(reveal.scores[0].score).toBe(20); // 1 bonne réponse sur 3 joueurs éligibles
		// Un joueur quitte en cours de partie : la partie continue
		leaveBattle(db, code, responders[2], t0 + SLOT);
		const end = t0 + 12 * SLOT + 1;
		expect(finalizeBattle(db, code, end)).toBe(true);
		expect(finalizeBattle(db, code, end)).toBe(false);
		const ranks = db.prepare('SELECT user_id, rank FROM battle_players WHERE battle_id = ? ORDER BY rank').all(b.id) as { user_id: number; rank: number }[];
		expect(ranks[0].user_id).toBe(responders[0]);
		const k = (u: number) => (db.prepare('SELECT kamas FROM users WHERE id = ?').get(u) as { kamas: number }).kamas;
		expect(k(responders[0])).toBe(150);
		expect(battleScores(db, getBattle(db, code), end)).toHaveLength(4);
	});
	it('l’hôte qui quitte le salon passe la main, salon vide annulé', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		const b = addUser(db, 'b');
		const code = createBattle(db, a, seededRng(1), 0);
		joinBattle(db, code, b, 1);
		leaveBattle(db, code, a, 2);
		expect(getBattle(db, code).host_id).toBe(b);
		leaveBattle(db, code, b, 3);
		expect(getBattle(db, code).status).toBe('cancelled');
	});
});

describe('échanges : contre-offre, cadeau, points de guilde', () => {
	it('la contre-offre remplace la proposition d’origine', () => {
		const db = testDb();
		const a = addUser(db, 'a', 100);
		const b = addUser(db, 'b', 100);
		give(db, a, 1);
		give(db, b, 2);
		give(db, b, 3);
		const t = createTrade(db, a, b, [1], 0, [2], null, 0);
		expect(() => createTrade(db, a, b, [1], 0, [3], null, 0, t)).toThrow(/Contre-proposition/);
		const c = createTrade(db, b, a, [3], 0, [1], 'Plutôt celle-ci ?', 1, t);
		expect((db.prepare('SELECT status FROM trades WHERE id = ?').get(t) as { status: string }).status).toBe('countered');
		expect(() => acceptTrade(db, t, b, 2)).toThrow();
		acceptTrade(db, c, a, 2);
		expect(copies(db, a, 3)).toBe(1);
		expect(copies(db, b, 1)).toBe(1);
	});
	it('offrir une carte souhaitée par un membre de sa guilde rapporte des points de guilde', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		const b = addUser(db, 'b');
		const g = createGuild(db, a, 'Les Tofus', 'TOF', '');
		joinGuild(db, b, g);
		give(db, a, 25); // rareté 1 dans la base de test
		toggleWish(db, b, 25);
		const t = createTrade(db, a, b, [25], 0, [], null, Date.now()); // cadeau
		acceptTrade(db, t, b, Date.now());
		const pts = (db.prepare('SELECT SUM(points) n FROM guild_points WHERE guild_id = ?').get(g) as { n: number }).n;
		expect(pts).toBe(150);
		expect(guildLeaderboard(db)[0].score).toBeGreaterThanOrEqual(150);
		expect(db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND card_id = 25').get(b)).toBeUndefined();
	});
});

describe('profil : vitrines, avatar, souhaits, blocage', () => {
	it('vitrines nommées (6 cartes max, possédées, une principale)', () => {
		const db = testDb();
		const u = addUser(db, 'u');
		[1, 2, 3, 4, 5, 6, 7].forEach((c) => give(db, u, c));
		const s1 = saveShowcase(db, u, null, 'Mes boss', [1, 2, 3]);
		expect(() => saveShowcase(db, u, null, 'Trop', [1, 2, 3, 4, 5, 6, 7])).toThrow(/6 cartes/);
		expect(() => saveShowcase(db, u, null, 'Pas à moi', [99])).toThrow(/possèdes/);
		const s2 = saveShowcase(db, u, null, 'Montures', [4, 5]);
		let list = listShowcases(db, u);
		expect(list[0]).toMatchObject({ id: s1, is_main: 1, cardIds: [1, 2, 3] });
		setMainShowcase(db, u, s2);
		list = listShowcases(db, u);
		expect(list[0].id).toBe(s2);
		expect(() => setAvatar(db, u, 99)).toThrow(/collection/);
		setAvatar(db, u, 4, 150, -3);
		expect(db.prepare('SELECT avatar_card_id, avatar_x, avatar_y FROM users WHERE id = ?').get(u)).toEqual({ avatar_card_id: 4, avatar_x: 100, avatar_y: 0 });
	});
	it('alerte liste de souhaits à la mise aux enchères', () => {
		const db = testDb();
		const seller = addUser(db, 's');
		const fan = addUser(db, 'f');
		give(db, seller, 9);
		expect(toggleWish(db, fan, 9)).toBe(true);
		createAuction(db, seller, 9, 10, 1, 0);
		const n = db.prepare("SELECT body FROM notifications WHERE user_id = ? AND kind = 'wish'").get(fan) as { body: string };
		expect(n.body).toMatch(/liste de souhaits/);
	});
	it('un joueur bloqué ne peut ni écrire, ni échanger, ni défier', () => {
		const db = testDb();
		const a = addUser(db, 'alice');
		const b = addUser(db, 'bruno');
		give(db, a, 1);
		give(db, b, 2);
		toggleBlock(db, b, a);
		expect(() => sendFriendRequest(db, a, 'bruno')).toThrow(/impossible/);
		expect(() => createTrade(db, a, b, [1], 0, [2], null, 0)).toThrow(/impossible/);
		reportUser(db, a, b, 'Spam', 'test');
		expect(() => reportUser(db, a, b, 'Inventé', '')).toThrow(/Motif/);
	});
});

describe('duels : chrono et revanche', () => {
	it('une réponse hors délai compte comme fausse ; revanche avec les mêmes cartes', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		[1, 2, 3].forEach((c) => give(db, a, c));
		const id = createDuel(db, a, null, [1, 2, 3], seededRng(2), 0);
		const q = nextQuestion(db, id, a, 1000)!;
		expect(q.deadline).toBe(21_000);
		const correct = (db.prepare('SELECT correct FROM duel_questions WHERE id = ?').get(q.id) as { correct: number }).correct;
		const r = answerQuestion(db, id, a, q.id, correct, 30_000);
		expect(r.correct).toBe(false);
		expect(r.timedOut).toBe(true);
		let next;
		while ((next = nextQuestion(db, id, a, 31_000))) answerQuestion(db, id, a, next.id, -1, 31_000);
		expect(getDuel(db, id).status).toBe('done');
		const again = rematch(db, id, a, seededRng(3), 40_000);
		expect(JSON.parse(getDuel(db, again).challenger_cards)).toEqual([1, 2, 3]);
		expect(getDuel(db, again).rematch_of).toBe(id);
	});
});
