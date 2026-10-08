import { getDb } from '#lib/server/db';
import { acceptFriend, inbox, listFriends, removeFriend, sendFriendRequest } from '#lib/server/game/social';
import { int, limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const guild = db.prepare('SELECT g.id, g.name, g.tag FROM users u JOIN guilds g ON g.id = u.guild_id WHERE u.id = ?').get(uid) as
		| { id: number; name: string; tag: string }
		| undefined;
	return { friends: listFriends(db, uid), inbox: inbox(db, uid), guild: guild ?? null };
};

export const actions: Actions = {
	add: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`friend:${uid}`, 20, 60_000);
			sendFriendRequest(getDb(), uid, str(f.get('username')));
			return { added: true };
		});
	},
	accept: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (acceptFriend(getDb(), uid, int(f.get('id'))), { ok: true }));
	},
	remove: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (removeFriend(getDb(), uid, int(f.get('id'))), { ok: true }));
	}
};
