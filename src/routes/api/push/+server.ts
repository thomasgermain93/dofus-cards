import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { removeSubscription, saveSubscription, vapidPublicKey } from '#lib/server/push';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json({ key: vapidPublicKey() });

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401);
	const sub = await request.json().catch(() => null);
	if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || String(sub.endpoint).length > 1000) return json({ error: 'Abonnement invalide.' }, { status: 400 });
	saveSubscription(getDb(), locals.user.id, sub);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401);
	const { endpoint } = await request.json().catch(() => ({ endpoint: '' }));
	if (endpoint) removeSubscription(getDb(), endpoint);
	return json({ ok: true });
};
