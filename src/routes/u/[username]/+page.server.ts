import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { findUserByName, friendshipStatus, sendFriendRequest } from '#lib/server/game/social';
import { collectionScore, playerStats, ACHIEVEMENTS } from '#lib/server/game/progress';
import { levelFromXp } from '#lib/server/game/constants';
import { censor } from '#lib/server/moderation';
import { CARD_COLS, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const found = findUserByName(db, params.username);
	if (!found) error(404, 'Joueur introuvable');
	const u = db
		.prepare('SELECT u.id, u.username, u.xp, u.bio, u.title, u.daily_streak, u.streak_best, u.created_at, u.banned, u.role, g.id guild_id, g.name guild, g.tag FROM users u LEFT JOIN guilds g ON g.id = u.guild_id WHERE u.id = ?')
		.get(found.id) as { id: number; username: string; xp: number; bio: string | null; title: string | null; daily_streak: number; streak_best: number; created_at: number; banned: number; role: string; guild_id: number | null; guild: string | null; tag: string | null };
	const showcase = db
		.prepare(`SELECT ${CARD_COLS} FROM favorites f JOIN cards c ON c.id = f.card_id WHERE f.user_id = ? ORDER BY c.rarity DESC LIMIT 6`)
		.all(u.id) as CardView[];
	const best = showcase.length
		? []
		: (db.prepare(`SELECT DISTINCT ${CARD_COLS} FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? ORDER BY c.rarity DESC, c.attack DESC LIMIT 6`).all(u.id) as CardView[]);
	const s = playerStats(db, u.id);
	const unlocked = (db.prepare('SELECT COUNT(*) n FROM achievements_unlocked WHERE user_id = ?').get(u.id) as { n: number }).n;
	const isMe = u.id === locals.user!.id;
	const ledger = isMe
		? (db.prepare('SELECT delta, reason, created_at FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 15').all(u.id) as { delta: number; reason: string; created_at: number }[])
		: [];
	const soldTotal = isMe
		? ((db.prepare("SELECT COALESCE(SUM(delta), 0) n FROM ledger WHERE user_id = ? AND reason LIKE 'sell:%'").get(u.id) as { n: number }).n)
		: 0;
	return {
		ledger,
		soldTotal,
		profile: { ...u, level: levelFromXp(u.xp) },
		isMe: u.id === locals.user!.id,
		relation: friendshipStatus(db, locals.user!.id, u.id),
		cards: showcase.length ? showcase : best,
		favorites: showcase.length > 0,
		stats: { distinct: s.distinct, legendary: s.legendary, duelWins: s.duelWins, duelsPlayed: s.duelsPlayed, score: collectionScore(db, u.id), unlocked, totalAchievements: ACHIEVEMENTS.length }
	};
};

export const actions: Actions = {
	friend: ({ locals, params }) => run(locals, (uid) => (sendFriendRequest(getDb(), uid, params.username), { requested: true })),
	bio: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			getDb().prepare('UPDATE users SET bio = ? WHERE id = ?').run(censor(str(f.get('bio')).trim().slice(0, 160)) || null, uid);
			return { saved: true };
		});
	}
};
