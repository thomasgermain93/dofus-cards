import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { findUserByName, friendshipStatus, sendFriendRequest } from '#lib/server/game/social';
import { collectionScore, playerStats, ACHIEVEMENTS } from '#lib/server/game/progress';
import { levelFromXp } from '#lib/server/game/constants';
import { listShowcases, reportUser, setPrivate, toggleBlock, userTags, REPORT_REASONS } from '#lib/server/game/profile';
import { cardsByIds } from '#lib/server/queries';
import { censor } from '#lib/server/moderation';
import { CARD_COLS, limit, run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const meId = locals.user!.id;
	const found = findUserByName(db, params.username);
	if (!found) error(404, 'Joueur introuvable');
	const u = db
		.prepare(
			`SELECT u.id, u.username, u.xp, u.bio, u.title, u.daily_streak, u.streak_best, u.created_at, u.banned, u.role, u.is_private,
				g.id guild_id, g.name guild, g.tag, c.image avatar, u.avatar_x, u.avatar_y
			 FROM users u LEFT JOIN guilds g ON g.id = u.guild_id LEFT JOIN cards c ON c.id = u.avatar_card_id WHERE u.id = ?`
		)
		.get(found.id) as {
		id: number; username: string; xp: number; bio: string | null; title: string | null; daily_streak: number; streak_best: number; created_at: number;
		banned: number; role: string; is_private: number; guild_id: number | null; guild: string | null; tag: string | null; avatar: string | null; avatar_x: number; avatar_y: number;
	};
	const isMe = u.id === meId;
	const relation = friendshipStatus(db, meId, u.id);
	const iBlocked = !!db.prepare('SELECT 1 FROM blocks WHERE user_id = ? AND blocked_id = ?').get(meId, u.id);
	const base = {
		profile: { ...u, level: levelFromXp(u.xp) },
		isMe,
		relation,
		iBlocked,
		reasons: REPORT_REASONS
	};
	// Profil privé : visible par soi-même, ses amis et les modérateurs
	if (u.is_private && !isMe && relation !== 'friends' && locals.user!.role !== 'admin') return { ...base, hidden: true as const };

	const shinyOwned = new Set(
		(db.prepare('SELECT DISTINCT card_id FROM user_cards WHERE user_id = ? AND shiny = 1').all(u.id) as { card_id: number }[]).map((r) => r.card_id)
	);
	const showcases = listShowcases(db, u.id).map((s) => ({ ...s, cards: cardsByIds(db, s.cardIds).map((c) => ({ ...c, foil: shinyOwned.has(c.id) })) }));
	const best = showcases.length
		? []
		: (db.prepare(`SELECT DISTINCT ${CARD_COLS} FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? ORDER BY c.rarity DESC, c.attack DESC LIMIT 6`).all(u.id) as CardView[]);
	const s = playerStats(db, u.id);
	const unlocked = db.prepare('SELECT code FROM achievements_unlocked WHERE user_id = ? ORDER BY unlocked_at DESC').all(u.id) as { code: string }[];
	const collections = db.prepare('SELECT key FROM collections_claimed WHERE user_id = ? ORDER BY claimed_at DESC').all(u.id) as { key: string }[];
	const badges = [
		...userTags(db, u.id).slice(0, 4).map((t) => ({ kind: 'tag', label: `${t.tag} x${t.n}` })),
		...collections.slice(0, 4).map((c) => ({ kind: 'collection', label: c.key.split(':').slice(1).join(':') })),
		...unlocked.slice(0, 6).map((a) => ({ kind: 'achievement', label: ACHIEVEMENTS.find((x) => x.code === a.code)?.name ?? a.code }))
	];
	const ledger = isMe
		? (db.prepare('SELECT delta, reason, created_at FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 15').all(u.id) as { delta: number; reason: string; created_at: number }[])
		: [];
	const soldTotal = isMe ? (db.prepare("SELECT COALESCE(SUM(delta), 0) n FROM ledger WHERE user_id = ? AND reason LIKE 'sell:%'").get(u.id) as { n: number }).n : 0;
	const duels = db
		.prepare(
			`SELECT d.id, d.result, d.winner_id, d.vs_bot, d.finished_at, uc.username challenger, uo.username opponent
			 FROM duels d JOIN users uc ON uc.id = d.challenger_id LEFT JOIN users uo ON uo.id = d.opponent_id
			 WHERE (d.challenger_id = ? OR d.opponent_id = ?) AND d.status = 'done' ORDER BY d.id DESC LIMIT 5`
		)
		.all(u.id, u.id) as { id: number; result: string; winner_id: number | null; vs_bot: number; finished_at: number; challenger: string; opponent: string | null }[];
	return {
		...base,
		hidden: false as const,
		showcases,
		best,
		badges,
		duels,
		ledger,
		soldTotal,
		stats: {
			distinct: s.distinct,
			legendary: s.legendary,
			duelWins: s.duelWins,
			duelsPlayed: s.duelsPlayed,
			score: collectionScore(db, u.id),
			unlocked: unlocked.length,
			totalAchievements: ACHIEVEMENTS.length,
			collections: collections.length,
			shinies: shinyOwned.size
		}
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
	},
	privacy: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => (setPrivate(getDb(), uid, f.get('private') === '1'), { saved: true }));
	},
	block: ({ locals, params }) =>
		run(locals, (uid) => {
			const target = findUserByName(getDb(), params.username);
			if (!target) error(404);
			return { blocked: toggleBlock(getDb(), uid, target.id) };
		}),
	report: async ({ locals, params, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => {
			limit(`report:${uid}`, 5, 60_000);
			const target = findUserByName(getDb(), params.username);
			if (!target) error(404);
			reportUser(getDb(), uid, target.id, str(f.get('reason')), str(f.get('details')));
			return { reported: true };
		});
	}
};
