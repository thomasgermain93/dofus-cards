import { error, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { battleState, joinBattle, leaveBattle, setBattleCards, startBattle } from '#lib/server/game/battle';
import { GameError, parseIds } from '#lib/server/game/core';
import { cryptoRng } from '#lib/server/game/rng';
import { ownedCards } from '#lib/server/queries';
import { run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	try {
		const state = battleState(db, params.code, locals.user!.id);
		return { state, mine: state.status === 'lobby' ? ownedCards(db, locals.user!.id) : [] };
	} catch (e) {
		if (e instanceof GameError) error(404, e.message);
		throw e;
	}
};

export const actions: Actions = {
	join: ({ locals, params }) => run(locals, (uid) => (joinBattle(getDb(), params.code, uid), { joined: true })),
	cards: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (setBattleCards(getDb(), params.code, uid, parseIds(str(f.get('cards')))), { cards: true }));
	},
	start: ({ locals, params }) => run(locals, (uid) => (startBattle(getDb(), params.code, uid, cryptoRng), { started: true })),
	leave: async ({ locals, params }) => {
		const r = await run(locals, (uid) => (leaveBattle(getDb(), params.code, uid), true));
		if (r === true) redirect(303, '/battle');
		return r;
	}
};
