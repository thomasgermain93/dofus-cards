import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { createDuel } from '#lib/server/game/duels';
import { findUserByName } from '#lib/server/game/social';
import { assert, parseIds } from '#lib/server/game/core';
import { cryptoRng } from '#lib/server/game/rng';
import { friendsOf, ownedCards } from '#lib/server/queries';
import { limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const db = getDb();
	const uid = locals.user!.id;
	return { friends: friendsOf(db, uid), vs: url.searchParams.get('vs') ?? '', mine: ownedCards(db, uid) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const f = await request.formData();
		const result = await run(locals, (uid) => {
			limit(`duel:${uid}`, 10, 60_000);
			const db = getDb();
			const vs = str(f.get('vs'));
			let opponent: number | null = null;
			if (vs !== 'bot') {
				const u = findUserByName(db, vs);
				assert(u, 'Choisis un adversaire.');
				opponent = u.id;
			}
			return createDuel(db, uid, opponent, parseIds(str(f.get('cards'))), cryptoRng);
		});
		if (typeof result === 'number') redirect(303, `/duels/${result}`);
		return result;
	}
};
