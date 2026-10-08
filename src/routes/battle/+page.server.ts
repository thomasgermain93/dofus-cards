import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { battleHistory, createBattle, joinBattle } from '#lib/server/game/battle';
import { cryptoRng } from '#lib/server/game/rng';
import { limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ history: battleHistory(getDb(), locals.user!.id) });

export const actions: Actions = {
	create: async ({ locals }) => {
		const r = await run(locals, (uid) => {
			limit(`battle-create:${uid}`, 5, 60_000);
			return createBattle(getDb(), uid, cryptoRng);
		});
		if (typeof r === 'string') redirect(303, `/battle/${r}`);
		return r;
	},
	join: async ({ locals, request }) => {
		const f = await request.formData();
		const code = str(f.get('code')).toUpperCase().replace(/[^A-Z0-9]/g, '');
		const r = await run(locals, (uid) => (joinBattle(getDb(), code, uid), code));
		if (typeof r === 'string') redirect(303, `/battle/${r}`);
		return r;
	}
};
