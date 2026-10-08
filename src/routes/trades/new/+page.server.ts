import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { createTrade } from '#lib/server/game/trades';
import { findUserByName } from '#lib/server/game/social';
import { assert, parseIds } from '#lib/server/game/core';
import { friendsOf, ownedCards } from '#lib/server/queries';
import { censor } from '#lib/server/moderation';
import { int, limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const toName = url.searchParams.get('to');
	const partner = toName ? findUserByName(db, toName) : undefined;
	return {
		friends: friendsOf(db, uid),
		partner: partner && partner.id !== uid && !partner.banned ? { id: partner.id, username: partner.username } : null,
		notFound: !!toName && !partner,
		mine: ownedCards(db, uid).filter((c) => c.free > 0),
		theirs: partner ? ownedCards(db, partner.id).filter((c) => c.free > 0) : [],
		give: int(url.searchParams.get('give'), 0)
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const f = await request.formData();
		const result = await run(locals, (uid) => {
			limit(`trade:${uid}`, 10, 60_000);
			const db = getDb();
			const partner = findUserByName(db, str(f.get('to')));
			assert(partner, 'Joueur introuvable.');
			const msg = str(f.get('message')).trim().slice(0, 200);
			return createTrade(db, uid, partner.id, parseIds(str(f.get('offer'))), Math.max(0, int(f.get('kamas'), 0)), parseIds(str(f.get('request'))), msg ? censor(msg) : null);
		});
		if (typeof result === 'number') redirect(303, `/trades/${result}`);
		return result;
	}
};
