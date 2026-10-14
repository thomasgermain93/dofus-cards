import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { destroySession, SESSION_COOKIE } from '#lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: ({ cookies }) => {
		destroySession(getDb(), cookies.get(SESSION_COOKIE));
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
};
