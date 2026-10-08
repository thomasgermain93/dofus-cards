import { json, error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { sellAllDuplicates, sellCards, type SellItem } from '#lib/server/game/collection';
import { GameError, getUser } from '#lib/server/game/core';
import { checkAchievements } from '#lib/server/game/progress';
import { rateLimit } from '#lib/server/moderation';
import type { RequestHandler } from './$types';

/**
 * Vente rapide (JSON) : utilisée par la fiche, l'album et l'ouverture de paquet.
 *   { items: [{ cardId, count }], nonce }  ou  { duplicates: true, maxRarity, nonce }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401);
	const uid = locals.user.id;
	let body: { items?: SellItem[]; duplicates?: boolean; maxRarity?: number; nonce?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Requête invalide.' }, { status: 400 });
	}
	const nonce = typeof body.nonce === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.nonce) ? body.nonce : null;
	if (!rateLimit(`sell:${uid}`, 40, 60_000)) return json({ error: 'Doucement ! Réessaie dans quelques secondes.' }, { status: 429 });
	const db = getDb();
	try {
		const r = body.duplicates
			? sellAllDuplicates(db, uid, Math.min(5, Math.max(0, Number(body.maxRarity ?? 2) | 0)), nonce)
			: sellCards(db, uid, (body.items ?? []).map((i) => ({ cardId: Number(i.cardId), count: Number(i.count) })), nonce);
		checkAchievements(db, uid);
		return json({ ...r, kamas: getUser(db, uid).kamas });
	} catch (e) {
		if (e instanceof GameError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
