import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { acceptDuel, answerQuestion, BOT_NAME, computeDuel, declineDuel, getDuel, nextQuestion } from '#lib/server/game/duels';
import { getCard, parseIds } from '#lib/server/game/core';
import { cryptoRng } from '#lib/server/game/rng';
import { cardsByIds, ownedCards } from '#lib/server/queries';
import { int, limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

const view = (c: ReturnType<typeof getCard>) => ({
	id: c.id, name: c.name, image: c.image, category: c.category, subtype: c.subtype, level: c.level,
	rarity: c.rarity, attack: c.attack, defense: c.defense, info1: c.info1, info2: c.info2
});

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const uid = locals.user!.id;
	let d;
	try {
		d = getDuel(db, int(params.id));
	} catch {
		error(404, 'Duel introuvable');
	}
	if (d.challenger_id !== uid && d.opponent_id !== uid) error(404, 'Duel introuvable');
	const name = (id: number | null) => (id == null ? BOT_NAME : (db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string }).username);
	const iAmChallenger = d.challenger_id === uid;
	const base = {
		duel: { id: d.id, status: d.status, vs_bot: !!d.vs_bot, result: d.result, winner_id: d.winner_id },
		me: { name: name(uid), challenger: iAmChallenger },
		other: { name: name(iAmChallenger ? d.opponent_id : d.challenger_id) }
	};
	const myCards = cardsByIds(db, parseIds(iAmChallenger ? d.challenger_cards : d.opponent_cards));
	const theirCards = cardsByIds(db, parseIds(iAmChallenger ? d.opponent_cards : d.challenger_cards));

	if (d.status === 'pending') {
		return { ...base, phase: iAmChallenger ? 'waiting-accept' : 'accept', myCards, theirCards, mine: iAmChallenger ? [] : ownedCards(db, uid) };
	}
	if (d.status === 'active') {
		const q = nextQuestion(db, d.id, uid);
		if (q) return { ...base, phase: 'quiz', question: q, attacker: view(getCard(db, q.cardId)), myCards, theirCards };
		return { ...base, phase: 'waiting-answers', myCards, theirCards };
	}
	if (d.status === 'done') {
		const r = computeDuel(db, d);
		const mineSide = iAmChallenger ? r.challenger : r.opponent;
		const theirSide = iAmChallenger ? r.opponent : r.challenger;
		const review = db
			.prepare('SELECT q.prompt, q.choices, q.correct, q.answer, c.name card FROM duel_questions q JOIN cards c ON c.id = q.card_id WHERE q.duel_id = ? AND q.answerer_id = ? ORDER BY q.position')
			.all(d.id, uid) as { prompt: string; choices: string; correct: number; answer: number | null; card: string }[];
		const side = (s: typeof mineSide) => ({ hp: s.hp, maxHp: s.maxHp, attacks: s.attacks.map((a) => ({ card: view(a.card), wrong: a.wrong, total: a.total, damage: a.damage })) });
		return {
			...base,
			phase: 'done',
			myCards,
			theirCards,
			mineSide: side(mineSide),
			theirSide: side(theirSide),
			review: review.map((x) => ({ ...x, choices: JSON.parse(x.choices) as string[] }))
		};
	}
	return { ...base, phase: d.status, myCards, theirCards };
};

export const actions: Actions = {
	accept: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (acceptDuel(getDb(), int(params.id), uid, parseIds(str(f.get('cards'))), cryptoRng), { accepted: true }));
	},
	decline: ({ locals, params }) => run(locals, (uid) => (declineDuel(getDb(), int(params.id), uid), { declined: true })),
	answer: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`answer:${uid}`, 60, 60_000);
			return answerQuestion(getDb(), int(params.id), uid, int(f.get('question')), int(f.get('choice')));
		});
	}
};
