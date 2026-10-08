import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { createSession, createUser, SESSION_COOKIE } from '#lib/server/auth';
import { GameError } from '#lib/server/game/core';
import { rateLimit } from '#lib/server/moderation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const f = await request.formData();
		const username = String(f.get('username') ?? '').trim();
		const password = String(f.get('password') ?? '');
		const confirm = String(f.get('confirm') ?? '');
		if (!rateLimit(`register:${getClientAddress()}`, 5, 3_600_000)) return fail(429, { username, error: 'Trop d’inscriptions depuis cette connexion. Réessaie plus tard.' });
		if (password !== confirm) return fail(400, { username, error: 'Les deux mots de passe ne correspondent pas.' });
		if (f.get('rules') !== 'on') return fail(400, { username, error: 'Merci d’accepter les règles de bonne conduite.' });
		try {
			const db = getDb();
			const id = await createUser(db, username, password);
			const s = createSession(db, id);
			cookies.set(SESSION_COOKIE, s.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' || process.env.NODE_ENV === 'production', expires: s.expires });
		} catch (e) {
			if (e instanceof GameError) return fail(400, { username, error: e.message });
			throw e;
		}
		redirect(303, '/?welcome=1');
	}
};
