import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { GameError } from '#lib/server/game/core';
import { finishOnboarding, markVisited, onboardingState, skipOnboarding } from '#lib/server/game/onboarding';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401);
	const db = getDb();
	const { action } = (await request.json().catch(() => ({}))) as { action?: string };
	try {
		if (action === 'album') markVisited(db, locals.user.id, 'album');
		else if (action === 'skip') skipOnboarding(db, locals.user.id);
		else if (action === 'finish') return json({ reward: finishOnboarding(db, locals.user.id), state: null });
		return json({ state: onboardingState(db, locals.user.id) });
	} catch (e) {
		if (e instanceof GameError) return json({ error: e.message }, { status: 400 });
		throw e;
	}
};
