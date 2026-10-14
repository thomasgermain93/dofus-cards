import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { conversation, findUserByName, friendshipStatus, sendMessage } from '#lib/server/game/social';
import { limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const other = findUserByName(db, params.username);
	if (!other) error(404, 'Joueur introuvable');
	return {
		other: { id: other.id, username: other.username },
		friends: friendshipStatus(db, locals.user!.id, other.id) === 'friends',
		messages: conversation(db, locals.user!.id, other.id)
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`msg:${uid}`, 15, 60_000);
			const db = getDb();
			const other = findUserByName(db, params.username);
			if (!other) error(404);
			sendMessage(db, uid, other.id, str(f.get('body')));
			return { sent: true };
		});
	}
};
