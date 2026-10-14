import { getDb } from '#lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const list = db.prepare('SELECT id, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(uid) as {
		id: number; body: string; link: string | null; read_at: number | null; created_at: number;
	}[];
	db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), uid);
	return { list };
};
