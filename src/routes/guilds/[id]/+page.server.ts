import { error, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { joinGuild, kickFromGuild, leaveGuild, postGuildMessage, transferLeadership } from '#lib/server/game/social';
import { weekStart } from '#lib/server/game/progress';
import { int, limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const id = int(params.id);
	const g = db.prepare('SELECT g.*, u.username leader FROM guilds g JOIN users u ON u.id = g.leader_id WHERE g.id = ?').get(id) as
		| { id: number; name: string; tag: string; description: string | null; leader_id: number; leader: string; created_at: number }
		| undefined;
	if (!g) error(404, 'Guilde introuvable');
	const members = db
		.prepare(
			`SELECT u.id, u.username, u.xp, COALESCE((SELECT SUM(points) FROM score_events e WHERE e.user_id = u.id AND e.created_at >= ?), 0) week
			 FROM users u WHERE u.guild_id = ? ORDER BY week DESC, u.username`
		)
		.all(weekStart(), id) as { id: number; username: string; xp: number; week: number }[];
	const isMember = members.some((m) => m.id === locals.user!.id);
	const myGuild = (db.prepare('SELECT guild_id FROM users WHERE id = ?').get(locals.user!.id) as { guild_id: number | null }).guild_id;
	const chat = isMember
		? (db
				.prepare('SELECT * FROM (SELECT m.id, m.body, m.created_at, u.username FROM guild_messages m JOIN users u ON u.id = m.user_id WHERE m.guild_id = ? ORDER BY m.id DESC LIMIT 60) ORDER BY id')
				.all(id) as { id: number; body: string; created_at: number; username: string }[])
		: [];
	return { guild: g, members, isMember, canJoin: !myGuild, chat };
};

export const actions: Actions = {
	join: ({ locals, params }) => run(locals, (uid) => (joinGuild(getDb(), uid, int(params.id)), { joined: true })),
	leave: async ({ locals }) => {
		const r = await run(locals, (uid) => (leaveGuild(getDb(), uid), true));
		if (r === true) redirect(303, '/guilds');
		return r;
	},
	post: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`gmsg:${uid}`, 15, 60_000);
			postGuildMessage(getDb(), uid, str(f.get('body')));
			return { posted: true };
		});
	},
	kick: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (kickFromGuild(getDb(), uid, int(f.get('id'))), { ok: true }));
	},
	promote: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (transferLeadership(getDb(), uid, int(f.get('id'))), { ok: true }));
	}
};
