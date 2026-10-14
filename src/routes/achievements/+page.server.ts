import { getDb } from '#lib/server/db';
import { ACHIEVEMENTS, checkAchievements, playerStats } from '#lib/server/game/progress';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	checkAchievements(db, uid);
	const done = new Map(
		(db.prepare('SELECT code, unlocked_at FROM achievements_unlocked WHERE user_id = ?').all(uid) as { code: string; unlocked_at: number }[]).map((r) => [r.code, r.unlocked_at])
	);
	const s = playerStats(db, uid);
	return {
		list: ACHIEVEMENTS.map((a) => ({
			code: a.code, name: a.name, description: a.description, reward: a.reward,
			unlockedAt: done.get(a.code) ?? null,
			progress: a.progress ? a.progress(s) : null
		}))
	};
};
