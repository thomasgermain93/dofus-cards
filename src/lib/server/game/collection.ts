import type { DB } from '../db';
import { DAILY_BASE_KAMAS, DAILY_BONUS_PACK, DAILY_STREAK_BONUS, DISCARD_VALUES } from './constants';
import { addKamas, assert, freeCopies, getCard, getUser } from './core';
import { givePacks } from './packs';

/**
 * Défausse `count` doublons d'une carte contre des kamas. On garde toujours au
 * moins un exemplaire : seuls les doublons non engagés (enchère) peuvent partir.
 */
export function discardDuplicates(db: DB, userId: number, cardId: number, count: number, now = Date.now()) {
	return db.transaction(() => {
		assert(Number.isInteger(count) && count > 0, 'Quantité invalide.');
		const card = getCard(db, cardId);
		const total = (
			db.prepare('SELECT COUNT(*) n FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId) as { n: number }
		).n;
		const free = freeCopies(db, userId, cardId);
		const discardable = Math.min(free.length, total - 1);
		assert(discardable >= count, "Tu n'as pas assez de doublons de cette carte.");
		const ids = free.slice(free.length - count);
		const del = db.prepare('DELETE FROM user_cards WHERE id = ?');
		for (const id of ids) del.run(id);
		const gain = DISCARD_VALUES[card.rarity] * count;
		addKamas(db, userId, gain, `discard:${cardId}x${count}`, now);
		return { gain };
	})();
}

/** Défausse tous les doublons du joueur (bouton « tout défausser »), plafonné à une rareté. */
export function discardAllDuplicates(db: DB, userId: number, maxRarity: number, now = Date.now()) {
	return db.transaction(() => {
		const rows = db
			.prepare(
				`SELECT uc.card_id, COUNT(*) n, SUM(uc.locked IS NULL) free, c.rarity
				 FROM user_cards uc JOIN cards c ON c.id = uc.card_id
				 WHERE uc.user_id = ? AND c.rarity <= ? GROUP BY uc.card_id HAVING n > 1`
			)
			.all(userId, maxRarity) as { card_id: number; n: number; free: number; rarity: number }[];
		let gain = 0;
		let cards = 0;
		for (const r of rows) {
			const count = Math.min(r.free, r.n - 1);
			if (count > 0) {
				gain += discardDuplicates(db, userId, r.card_id, count, now).gain;
				cards += count;
			}
		}
		return { gain, cards };
	})();
}

export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

export function dailyAvailable(lastDay: string | null, now: number) {
	return lastDay !== dayKey(now);
}

/** Récompense quotidienne : kamas (+ bonus de série jusqu'à 7 jours) + 1 paquet. */
export function claimDaily(db: DB, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const u = getUser(db, userId);
		const today = dayKey(now);
		assert(u.daily_last !== today, 'Récompense déjà récupérée aujourd’hui. Reviens demain !');
		const yesterday = dayKey(now - 86_400_000);
		const streak = u.daily_last === yesterday ? u.daily_streak + 1 : 1;
		const kamas = DAILY_BASE_KAMAS + DAILY_STREAK_BONUS * Math.min(streak - 1, 6);
		db.prepare('UPDATE users SET daily_last = ?, daily_streak = ? WHERE id = ?').run(today, streak, userId);
		addKamas(db, userId, kamas, 'daily', now);
		givePacks(db, userId, DAILY_BONUS_PACK, now);
		return { kamas, streak, packs: DAILY_BONUS_PACK };
	})();
}
