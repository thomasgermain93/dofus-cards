import { getDb } from '#lib/server/db';
import { collectionLeaderboard, guildLeaderboard, weekStart, weeklyLeaderboard } from '#lib/server/game/progress';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const tab = ['guilds', 'collection'].includes(url.searchParams.get('tab') ?? '') ? url.searchParams.get('tab')! : 'week';
	const start = weekStart();
	return {
		tab,
		weekEnds: start + 7 * 86_400_000,
		now: Date.now(),
		players: tab === 'week' ? weeklyLeaderboard(db) : [],
		guilds: tab === 'guilds' ? guildLeaderboard(db) : [],
		collection: tab === 'collection' ? collectionLeaderboard(db) : []
	};
};
