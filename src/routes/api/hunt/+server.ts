import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { GameError } from '#lib/server/game/core';
import { claimHunt } from '#lib/server/game/onboarding';
import { cryptoRng } from '#lib/server/game/rng';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401);
	const { path } = (await request.json().catch(() => ({}))) as { path?: string };
	try {
		return json(claimHunt(getDb(), locals.user.id, String(path ?? ''), cryptoRng));
	} catch (e) {
		if (e instanceof GameError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
