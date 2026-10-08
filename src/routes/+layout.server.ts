import { getDb } from '#lib/server/db';
import { getUser } from '#lib/server/game/core';
import { getPackState } from '#lib/server/game/packs';
import { levelFromXp, xpForLevel } from '#lib/server/game/constants';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) return { me: null };
	const db = getDb();
	const u = getUser(db, locals.user.id);
	const now = Date.now();
	const packs = getPackState(db, u.id, now);
	const n = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n;
	const level = levelFromXp(u.xp);
	return {
		me: {
			id: u.id,
			username: u.username,
			role: u.role,
			kamas: u.kamas,
			xp: u.xp,
			level,
			levelFrom: xpForLevel(level),
			levelTo: xpForLevel(level + 1),
			packs: packs.stock,
			nextPackAt: packs.nextInMs == null ? null : now + packs.nextInMs,
			serverNow: now,
			unreadNotifs: n('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', u.id),
			unreadMessages: n('SELECT COUNT(*) n FROM messages WHERE to_id = ? AND read_at IS NULL', u.id),
			duelsToPlay: n(
				`SELECT COUNT(*) n FROM duels d WHERE (d.status = 'pending' AND d.opponent_id = ?)
				 OR (d.status = 'active' AND EXISTS (SELECT 1 FROM duel_questions q WHERE q.duel_id = d.id AND q.answerer_id = ? AND q.answer IS NULL))`,
				u.id,
				u.id
			),
			tradesPending: n("SELECT COUNT(*) n FROM trades WHERE to_id = ? AND status = 'pending'", u.id),
			friendRequests: n("SELECT COUNT(*) n FROM friendships WHERE friend_id = ? AND status = 'pending'", u.id)
		}
	};
};
