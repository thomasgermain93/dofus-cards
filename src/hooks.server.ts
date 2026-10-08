import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { SESSION_COOKIE, purgeSessions, sessionUser } from '#lib/server/auth';
import { settleExpiredAuctions } from '#lib/server/game/auctions';
import { dataDir, getDb } from '#lib/server/db';
import { initPush, notifyFullReserves } from '#lib/server/push';

const PUBLIC = ['/login', '/register', '/mentions', '/img/', '/icons/', '/manifest.webmanifest', '/favicon', '/service-worker.js', '/robots.txt'];

// Tâches planifiées : clôture des enchères échues (toutes les 15 s), purge des sessions (toutes les heures).
const g = globalThis as unknown as { __dcTimers?: boolean };
if (!building && !g.__dcTimers && process.env.NODE_ENV !== 'test') {
	g.__dcTimers = true;
	setInterval(() => {
		try {
			settleExpiredAuctions(getDb());
		} catch (e) {
			console.error('[enchères]', e);
		}
	}, 15_000).unref();
	setInterval(() => purgeSessions(getDb()), 3_600_000).unref();
	try {
		initPush(dataDir());
		setInterval(() => {
			try {
				notifyFullReserves(getDb());
			} catch (e) {
				console.error('[push]', e);
			}
		}, 60_000).unref();
	} catch (e) {
		console.error('[push] désactivé', e);
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const db = getDb();
	event.locals.user = sessionUser(db, event.cookies.get(SESSION_COOKIE));
	const path = event.url.pathname;
	const isPublic = path === '/' || PUBLIC.some((p) => path.startsWith(p));
	if (!event.locals.user && !isPublic) redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	if (path.startsWith('/admin') && event.locals.user?.role !== 'admin') redirect(303, '/');

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (process.env.NOINDEX !== '0') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	return response;
};
