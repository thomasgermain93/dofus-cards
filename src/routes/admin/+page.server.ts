import { getDb } from '#lib/server/db';
import { GameError, assert } from '#lib/server/game/core';
import { int, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const q = (url.searchParams.get('q') ?? '').trim();
	const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
	const users = db
		.prepare(
			`SELECT id, username, role, banned, ban_reason, kamas, xp, created_at FROM users
			 ${q ? "WHERE username LIKE '%' || ? || '%'" : ''} ORDER BY id DESC LIMIT 50`
		)
		.all(...(q ? [q] : [])) as { id: number; username: string; role: string; banned: number; ban_reason: string | null; kamas: number; xp: number; created_at: number }[];
	const messages = db
		.prepare(
			`SELECT m.id, m.body, m.created_at, uf.username sender, ut.username recipient FROM messages m
			 JOIN users uf ON uf.id = m.from_id JOIN users ut ON ut.id = m.to_id ORDER BY m.id DESC LIMIT 20`
		)
		.all() as { id: number; body: string; created_at: number; sender: string; recipient: string }[];
	return {
		q,
		users,
		messages,
		stats: {
			users: n('SELECT COUNT(*) n FROM users'),
			banned: n('SELECT COUNT(*) n FROM users WHERE banned = 1'),
			cards: n('SELECT COUNT(*) n FROM cards WHERE active = 1'),
			packs: n('SELECT COUNT(*) n FROM pack_openings'),
			auctions: n("SELECT COUNT(*) n FROM auctions WHERE status = 'open'"),
			duels: n("SELECT COUNT(*) n FROM duels WHERE status = 'done'")
		}
	};
};

export const actions: Actions = {
	ban: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (adminId) => {
			const db = getDb();
			const id = int(f.get('id'));
			assert(id !== adminId, 'Tu ne peux pas te bannir toi-même.');
			const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
			if (!target) throw new GameError('Joueur introuvable.');
			assert(target.role !== 'admin', 'Impossible de bannir un administrateur.');
			db.transaction(() => {
				db.prepare('UPDATE users SET banned = 1, ban_reason = ? WHERE id = ?').run(str(f.get('reason')).slice(0, 200) || null, id);
				db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
			})();
			return { done: 'banned' };
		});
	},
	unban: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, () => {
			getDb().prepare('UPDATE users SET banned = 0, ban_reason = NULL WHERE id = ?').run(int(f.get('id')));
			return { done: 'unbanned' };
		});
	},
	deleteMessage: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, () => {
			getDb().prepare("UPDATE messages SET body = '[message supprimé par la modération]' WHERE id = ?").run(int(f.get('id')));
			return { done: 'deleted' };
		});
	}
};
