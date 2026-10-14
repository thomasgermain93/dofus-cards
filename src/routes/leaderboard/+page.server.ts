import { getDb } from '#lib/server/db';
import { collectionLeaderboard, guildLeaderboard, weekStart, weeklyLeaderboard } from '#lib/server/game/progress';
import type { PageServerLoad } from './$types';
import { userBriefs } from '#lib/server/queries';

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const tab = ['guilds', 'collection'].includes(url.searchParams.get('tab') ?? '') ? url.searchParams.get('tab')! : 'week';
	const start = weekStart();
	const players = tab === 'week' ? weeklyLeaderboard(db) : [];
	const collection = tab === 'collection' ? collectionLeaderboard(db) : [];
	const briefs = Object.fromEntries(userBriefs(db, [...players, ...collection].map((p) => p.id)));
	return {
		briefs,
		tab,
		weekEnds: start + 7 * 86_400_000,
		now: Date.now(),
		players,
		guilds: tab === 'guilds' ? guildLeaderboard(db) : [],
		collection
	};
};
