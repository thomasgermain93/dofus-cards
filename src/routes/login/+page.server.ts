import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { checkLogin, createSession, SESSION_COOKIE } from '#lib/server/auth';
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
		if (!rateLimit(`login:${getClientAddress()}`, 10, 60_000)) return fail(429, { username, error: 'Trop de tentatives. Réessaie dans une minute.' });
		try {
			const db = getDb();
			const id = await checkLogin(db, username, password);
			const s = createSession(db, id);
			cookies.set(SESSION_COOKIE, s.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' || process.env.NODE_ENV === 'production', expires: s.expires });
		} catch (e) {
			if (e instanceof GameError) return fail(400, { username, error: e.message });
			throw e;
		}
		const next = url.searchParams.get('next');
		redirect(303, next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
	}
};
