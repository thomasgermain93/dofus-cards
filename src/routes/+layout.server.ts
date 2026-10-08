import { getDb } from '#lib/server/db';
import { getUser } from '#lib/server/game/core';
import { getPackState } from '#lib/server/game/packs';
import { levelFromXp, xpForLevel } from '#lib/server/game/constants';
import { brusselsDay, brusselsWeek } from '#lib/server/game/time';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) return { me: null };
	const db = getDb();
	const u = getUser(db, locals.user.id);
	const now = Date.now();
	const packs = getPackState(db, u.id, now);
	const n = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n;
	const level = levelFromXp(u.xp);
	const av = db.prepare('SELECT c.image, u.avatar_x x, u.avatar_y y FROM users u LEFT JOIN cards c ON c.id = u.avatar_card_id WHERE u.id = ?').get(u.id) as { image: string | null; x: number; y: number };
	return {
		me: {
			id: u.id,
			username: u.username,
			role: u.role,
			avatar: av.image,
			avatarX: av.x,
			avatarY: av.y,
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
			friendRequests: n("SELECT COUNT(*) n FROM friendships WHERE friend_id = ? AND status = 'pending'", u.id),
			homeTodo:
				n(
					"SELECT COUNT(*) n FROM quests WHERE user_id = ? AND progress >= target AND claimed_at IS NULL AND ((period = 'day' AND period_key = ?) OR (period = 'week' AND period_key = ?))",
					u.id,
					brusselsDay(now),
					brusselsWeek(now)
				) + (u.daily_last !== brusselsDay(now) ? 1 : 0)
		}
	};
};
