import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { answerBattle, battleState } from '#lib/server/game/battle';
import { GameError } from '#lib/server/game/core';
import { rateLimit } from '#lib/server/moderation';
import type { RequestHandler } from './$types';

/** État de la bataille (sondage court côté client, toutes les secondes). */
export const GET: RequestHandler = ({ locals, params }) => {
	if (!locals.user) error(401);
	try {
		return json(battleState(getDb(), params.code, locals.user.id), { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		if (e instanceof GameError) return json({ error: e.message }, { status: 404 });
		throw e;
	}
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401);
	if (!rateLimit(`battle-answer:${locals.user.id}`, 30, 30_000)) return json({ error: 'Doucement !' }, { status: 429 });
	const body = (await request.json().catch(() => ({}))) as { index?: number; choice?: number };
	try {
		answerBattle(getDb(), params.code, locals.user.id, Number(body.index), Number(body.choice));
		return json({ ok: true });
	} catch (e) {
		if (e instanceof GameError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
