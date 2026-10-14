import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { GameError } from '#lib/server/game/core';
import { setFavorites, tagCards, untagCards } from '#lib/server/game/profile';
import { rateLimit } from '#lib/server/moderation';
import type { RequestHandler } from './$types';

/** Actions groupées sur une sélection de cartes : étiqueter, retirer une étiquette, favoris. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401);
	if (!rateLimit(`cards:${locals.user.id}`, 60, 60_000)) return json({ error: 'Doucement !' }, { status: 429 });
	const body = (await request.json().catch(() => ({}))) as { action?: string; cardIds?: number[]; tag?: string };
	const ids = (body.cardIds ?? []).map(Number).filter(Number.isInteger).slice(0, 500);
	const db = getDb();
	try {
		switch (body.action) {
			case 'tag':
				return json(tagCards(db, locals.user.id, ids, String(body.tag ?? '')));
			case 'untag':
				return json({ removed: untagCards(db, locals.user.id, ids, String(body.tag ?? '')) });
			case 'fav':
				return json({ changed: setFavorites(db, locals.user.id, ids, true) });
			case 'unfav':
				return json({ changed: setFavorites(db, locals.user.id, ids, false) });
			default:
				return json({ error: 'Action inconnue.' }, { status: 400 });
		}
	} catch (e) {
		if (e instanceof GameError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
