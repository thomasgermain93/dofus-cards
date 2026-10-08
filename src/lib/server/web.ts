import { fail, redirect } from '@sveltejs/kit';
import { GameError } from './game/core';
import { rateLimit } from './moderation';
import { checkAchievements } from './game/progress';
import { getDb } from './db';

export function requireUser(locals: App.Locals) {
	if (!locals.user) redirect(303, '/login');
	return locals.user;
}

/** Exécute une action de jeu : les erreurs métier deviennent un message affichable. */
export async function run<T>(locals: App.Locals, fn: (userId: number) => T | Promise<T>) {
	const user = requireUser(locals);
	try {
		const result = await fn(user.id);
		checkAchievements(getDb(), user.id);
		return result;
	} catch (e) {
		if (e instanceof GameError) return fail(400, { error: e.message });
		throw e;
	}
}

/** Limite de débit : lève une erreur affichable si dépassée. */
export function limit(key: string, count: number, windowMs: number) {
	if (!rateLimit(key, count, windowMs)) throw new GameError('Doucement ! Réessaie dans quelques secondes.');
}

export const int = (v: FormDataEntryValue | string | null | undefined, fallback = NaN) => {
	const n = Number.parseInt(String(v ?? ''), 10);
	return Number.isFinite(n) ? n : fallback;
};
export const str = (v: FormDataEntryValue | null | undefined) => (typeof v === 'string' ? v : '');

/** Colonnes publiques d'une carte (pour l'affichage). */
export const CARD_COLS = 'c.id, c.name, c.image, c.category, c.subtype, c.level, c.rarity, c.attack, c.defense, c.info1, c.info2';
