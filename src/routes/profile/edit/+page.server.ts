import { getDb } from '#lib/server/db';
import { deleteShowcase, listShowcases, saveShowcase, setAvatar, setMainShowcase, SHOWCASE_SLOTS, MAX_SHOWCASES } from '#lib/server/game/profile';
import { ownedCards } from '#lib/server/queries';
import { parseIds } from '#lib/server/game/core';
import { int, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const u = db.prepare('SELECT avatar_card_id, avatar_x, avatar_y FROM users WHERE id = ?').get(uid) as { avatar_card_id: number | null; avatar_x: number; avatar_y: number };
	return { mine: ownedCards(db, uid), avatar: u, showcases: listShowcases(db, uid), slots: SHOWCASE_SLOTS, max: MAX_SHOWCASES };
};

export const actions: Actions = {
	avatar: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			const card = int(f.get('card'), 0);
			setAvatar(getDb(), uid, card || null, int(f.get('x'), 50), int(f.get('y'), 40));
			return { saved: 'avatar' };
		});
	},
	showcase: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			const id = int(f.get('id'), 0);
			saveShowcase(getDb(), uid, id || null, str(f.get('name')), parseIds(str(f.get('cards'))));
			return { saved: 'showcase' };
		});
	},
	main: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (setMainShowcase(getDb(), uid, int(f.get('id'))), { saved: 'main' }));
	},
	remove: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (deleteShowcase(getDb(), uid, int(f.get('id'))), { saved: 'removed' }));
	}
};
