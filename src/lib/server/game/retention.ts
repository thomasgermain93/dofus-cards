import type { DB } from '../db';
import { CHEST_TIERS, DAILY_BONUS_PACK, DAILY_CALENDAR } from './constants';
import { addKamas, assert, getUser, notify } from './core';
import { givePacks } from './packs';
import { addBooster, addFragments } from './quests';
import { addDays, brusselsDay, brusselsWeek, dayDiff } from './time';

/* ------------------------------------------------------------------ */
/* Série de connexion (récompense du jour)                             */
/* ------------------------------------------------------------------ */

/**
 * Nouvelle valeur de la série si on récupère aujourd'hui (fonction pure).
 * - lendemain : +1 ;
 * - un seul jour manqué : la série continue grâce au joker (1 par semaine) ;
 * - absence plus longue : rattrapage doux, la série est divisée par deux (jamais remise à zéro brutalement).
 */
export function nextStreak(last: string | null, streak: number, today: string, jokerWeek: string | null, week: string) {
	if (!last) return { streak: 1, jokerUsed: false };
	const gap = dayDiff(last, today);
	if (gap <= 0) return { streak, jokerUsed: false };
	if (gap === 1) return { streak: streak + 1, jokerUsed: false };
	if (gap === 2 && jokerWeek !== week) return { streak: streak + 1, jokerUsed: true };
	return { streak: Math.max(1, Math.floor(streak / 2)), jokerUsed: false };
}

/** Jour du calendrier (1 à 7) correspondant à une valeur de série. */
export const calendarDay = (streak: number) => ((Math.max(1, streak) - 1) % 7) + 1;

export function dailyStatus(db: DB, userId: number, now = Date.now()) {
	const u = getUser(db, userId);
	const today = brusselsDay(now);
	const week = brusselsWeek(now);
	const available = u.daily_last !== today;
	const preview = available ? nextStreak(u.daily_last, u.daily_streak, today, u.joker_week, week) : { streak: u.daily_streak, jokerUsed: false };
	// Série « en danger » : manquer demain la ferait baisser (sauf joker)
	const missedYesterday = u.daily_last != null && dayDiff(u.daily_last, today) >= 2;
	return {
		available,
		streak: u.daily_streak,
		best: u.streak_best,
		nextStreak: preview.streak,
		willUseJoker: preview.jokerUsed,
		jokerAvailable: u.joker_week !== week,
		missedYesterday,
		todayIndex: calendarDay(preview.streak),
		calendar: DAILY_CALENDAR
	};
}

export function claimDaily(db: DB, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const u = getUser(db, userId);
		const today = brusselsDay(now);
		const week = brusselsWeek(now);
		assert(u.daily_last !== today, 'Récompense déjà récupérée aujourd’hui. Reviens demain !');
		const { streak, jokerUsed } = nextStreak(u.daily_last, u.daily_streak, today, u.joker_week, week);
		const day = calendarDay(streak);
		const reward = DAILY_CALENDAR[day - 1];
		db.prepare('UPDATE users SET daily_last = ?, daily_streak = ?, streak_best = MAX(streak_best, ?), joker_week = ? WHERE id = ?').run(
			today,
			streak,
			streak,
			jokerUsed ? week : u.joker_week,
			userId
		);
		addKamas(db, userId, reward.kamas, 'daily', now);
		if (reward.fragments) addFragments(db, userId, reward.fragments);
		if (reward.booster) addBooster(db, userId, reward.booster);
		givePacks(db, userId, DAILY_BONUS_PACK, now);
		return { streak, day, jokerUsed, kamas: reward.kamas, fragments: reward.fragments ?? 0, booster: reward.booster ?? null, packs: DAILY_BONUS_PACK };
	})();
}

/* ------------------------------------------------------------------ */
/* Coffre de la semaine                                                 */
/* ------------------------------------------------------------------ */

export const tierFor = (count: number) => CHEST_TIERS.find((t) => count >= t.min) ?? null;

function questsClaimedInWeek(db: DB, userId: number, week: string) {
	const end = addDays(week, 7);
	return (
		db
			.prepare(
				`SELECT COUNT(*) n FROM quests WHERE user_id = ? AND claimed_at IS NOT NULL
				 AND ((period = 'day' AND period_key >= ? AND period_key < ?) OR (period = 'week' AND period_key = ?))`
			)
			.get(userId, week, end, week) as { n: number }
	).n;
}

/** Le coffre se remplit pendant la semaine (quêtes récupérées) et s'ouvre à partir du lundi suivant. */
export function chestStatus(db: DB, userId: number, now = Date.now()) {
	const week = brusselsWeek(now);
	const prevWeek = addDays(week, -7);
	const current = questsClaimedInWeek(db, userId, week);
	const previous = questsClaimedInWeek(db, userId, prevWeek);
	const claimed = !!db.prepare('SELECT 1 FROM chests_claimed WHERE user_id = ? AND week_key = ?').get(userId, prevWeek);
	return {
		current: { week, count: current, tier: tierFor(current), next: [...CHEST_TIERS].reverse().find((t) => current < t.min) ?? null },
		previous: { week: prevWeek, count: previous, tier: tierFor(previous), claimed },
		tiers: CHEST_TIERS
	};
}

export function claimChest(db: DB, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const st = chestStatus(db, userId, now);
		assert(!st.previous.claimed, 'Coffre déjà ouvert.');
		const tier = st.previous.tier;
		assert(tier, 'Pas de coffre la semaine dernière : il faut au moins 4 quêtes récupérées.');
		db.prepare('INSERT INTO chests_claimed (user_id, week_key, tier, claimed_at) VALUES (?, ?, ?, ?)').run(userId, st.previous.week, tier.tier, now);
		addKamas(db, userId, tier.kamas, `chest:${st.previous.week}`, now);
		addFragments(db, userId, tier.fragments);
		addBooster(db, userId, tier.booster);
		notify(db, userId, 'chest', `${tier.name} ouvert : +${tier.kamas} kamas, +${tier.fragments} fragments et un booster !`, '/quests', now);
		return tier;
	})();
}
