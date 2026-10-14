import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { createGuild, joinGuild } from '#lib/server/game/social';
import { guildLeaderboard } from '#lib/server/game/progress';
import { int, limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const db = getDb();
	const me = db.prepare('SELECT guild_id FROM users WHERE id = ?').get(locals.user!.id) as { guild_id: number | null };
	if (me.guild_id && !url.searchParams.has('all')) redirect(303, `/guilds/${me.guild_id}`);
	const guilds = db
		.prepare(
			`SELECT g.id, g.name, g.tag, g.description, COUNT(u.id) members, l.username leader
			 FROM guilds g LEFT JOIN users u ON u.guild_id = g.id JOIN users l ON l.id = g.leader_id GROUP BY g.id ORDER BY members DESC, g.id LIMIT 100`
		)
		.all() as { id: number; name: string; tag: string; description: string | null; members: number; leader: string }[];
	return { guilds, weekly: guildLeaderboard(db), inGuild: !!me.guild_id };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const f = await request.formData();
		const r = await run(locals, (uid) => {
			limit(`guild:${uid}`, 5, 60_000);
			return createGuild(getDb(), uid, str(f.get('name')), str(f.get('tag')), str(f.get('description')));
		});
		if (typeof r === 'number') redirect(303, `/guilds/${r}`);
		return r;
	},
	join: async ({ locals, request }) => {
		const f = await request.formData();
		const id = int(f.get('id'));
		const r = await run(locals, (uid) => (joinGuild(getDb(), uid, id), id));
		if (typeof r === 'number') redirect(303, `/guilds/${r}`);
		return r;
	}
};
