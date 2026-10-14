import type { DB } from '../db';
import { COLLECTION_POINTS } from './constants';
import { addKamas, addXp, notify } from './core';
import { addDays, brusselsWeek, nextBrusselsMidnight } from './time';

interface Stats {
	distinct: number;
	legendary: number;
	ultra: number;
	classes: number;
	dofus: number;
	duelWins: number;
	duelsPlayed: number;
	sales: number;
	trades: number;
	guild: boolean;
	streak: number;
	friends: number;
	zonesCompleted: number;
	packs: number;
}

export interface Achievement {
	code: string;
	name: string;
	description: string;
	reward: number;
	test: (s: Stats) => boolean;
	progress?: (s: Stats) => [number, number];
}

export const ACHIEVEMENTS: Achievement[] = [
	{ code: 'first-pack', name: 'Premier paquet', description: 'Ouvrir ton premier paquet.', reward: 20, test: (s) => s.packs >= 1 },
	{ code: 'packs-50', name: 'Accro aux paquets', description: 'Ouvrir 50 paquets.', reward: 150, test: (s) => s.packs >= 50, progress: (s) => [s.packs, 50] },
	{ code: 'cards-50', name: 'Apprenti collectionneur', description: 'Posséder 50 cartes différentes.', reward: 50, test: (s) => s.distinct >= 50, progress: (s) => [s.distinct, 50] },
	{ code: 'cards-250', name: 'Collectionneur', description: 'Posséder 250 cartes différentes.', reward: 200, test: (s) => s.distinct >= 250, progress: (s) => [s.distinct, 250] },
	{ code: 'cards-1000', name: 'Encyclopédiste', description: 'Posséder 1 000 cartes différentes.', reward: 1000, test: (s) => s.distinct >= 1000, progress: (s) => [s.distinct, 1000] },
	{ code: 'first-ultra', name: 'Ultra chanceux', description: 'Obtenir une carte Ultra rare.', reward: 50, test: (s) => s.ultra >= 1 },
	{ code: 'first-legendary', name: 'Légende vivante', description: 'Obtenir ta première carte Légendaire.', reward: 200, test: (s) => s.legendary >= 1 },
	{ code: 'first-dofus', name: 'Chasseur de Dofus', description: 'Obtenir une carte Dofus.', reward: 100, test: (s) => s.dofus >= 1 },
	{ code: 'classes-5', name: 'Polyvalent', description: 'Posséder 5 classes différentes.', reward: 100, test: (s) => s.classes >= 5, progress: (s) => [s.classes, 5] },
	{ code: 'zone-1', name: 'Explorateur', description: 'Compléter tous les monstres d’une zone (3 monstres ou plus).', reward: 150, test: (s) => s.zonesCompleted >= 1 },
	{ code: 'duel-1', name: 'Premier sang', description: 'Gagner un duel.', reward: 30, test: (s) => s.duelWins >= 1 },
	{ code: 'duel-10', name: 'Duelliste', description: 'Gagner 10 duels.', reward: 150, test: (s) => s.duelWins >= 10, progress: (s) => [s.duelWins, 10] },
	{ code: 'duel-50', name: 'Maître du quiz', description: 'Gagner 50 duels.', reward: 500, test: (s) => s.duelWins >= 50, progress: (s) => [s.duelWins, 50] },
	{ code: 'first-sale', name: 'Marchand', description: 'Vendre une carte aux enchères.', reward: 50, test: (s) => s.sales >= 1 },
	{ code: 'first-trade', name: 'Troc', description: 'Réussir un échange.', reward: 50, test: (s) => s.trades >= 1 },
	{ code: 'friends-3', name: 'Bien entouré', description: 'Avoir 3 amis.', reward: 50, test: (s) => s.friends >= 3, progress: (s) => [s.friends, 3] },
	{ code: 'guild', name: 'Esprit de guilde', description: 'Rejoindre ou créer une guilde.', reward: 30, test: (s) => s.guild },
	{ code: 'streak-7', name: 'Fidèle', description: 'Récupérer la récompense quotidienne 7 jours de suite.', reward: 200, test: (s) => s.streak >= 7, progress: (s) => [s.streak, 7] }
];

const one = (db: DB, sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n ?? 0;

export function playerStats(db: DB, userId: number): Stats {
	const rarityCount = (r: number) =>
		one(db, 'SELECT COUNT(DISTINCT uc.card_id) n FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? AND c.rarity = ?', userId, r);
	const u = db.prepare('SELECT guild_id, daily_streak FROM users WHERE id = ?').get(userId) as { guild_id: number | null; daily_streak: number };
	const zonesCompleted = one(
		db,
		`SELECT COUNT(*) n FROM (
			SELECT json_extract(c.facts, '$.zone') z, COUNT(*) total,
				SUM(EXISTS(SELECT 1 FROM user_cards uc WHERE uc.user_id = ? AND uc.card_id = c.id)) owned
			FROM cards c WHERE c.active = 1 AND c.category = 'monster' AND json_extract(c.facts, '$.zone') IS NOT NULL
			GROUP BY z HAVING total >= 3 AND owned = total)`,
		userId
	);
	return {
		distinct: one(db, 'SELECT COUNT(DISTINCT card_id) n FROM user_cards WHERE user_id = ?', userId),
		legendary: rarityCount(5),
		ultra: rarityCount(4),
		classes: one(db, "SELECT COUNT(DISTINCT uc.card_id) n FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? AND c.category = 'class'", userId),
		dofus: one(db, "SELECT COUNT(*) n FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? AND c.subtype = 'Dofus'", userId),
		duelWins: one(db, "SELECT COUNT(*) n FROM duels WHERE winner_id = ? AND status = 'done'", userId),
		duelsPlayed: one(db, "SELECT COUNT(*) n FROM duels WHERE (challenger_id = ? OR opponent_id = ?) AND status = 'done'", userId, userId),
		sales: one(db, "SELECT COUNT(*) n FROM auctions WHERE seller_id = ? AND status = 'sold'", userId),
		trades: one(db, "SELECT COUNT(*) n FROM trades WHERE (from_id = ? OR to_id = ?) AND status = 'accepted'", userId, userId),
		guild: u?.guild_id != null,
		streak: u?.daily_streak ?? 0,
		friends: one(db, "SELECT COUNT(*) n FROM friendships WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'", userId, userId),
		zonesCompleted,
		packs: one(db, 'SELECT COUNT(*) n FROM pack_openings WHERE user_id = ?', userId)
	};
}

/** Débloque les succès atteints (récompense en kamas + XP). Renvoie les nouveaux succès. */
export function checkAchievements(db: DB, userId: number, now = Date.now()): Achievement[] {
	const done = new Set(
		(db.prepare('SELECT code FROM achievements_unlocked WHERE user_id = ?').all(userId) as { code: string }[]).map((r) => r.code)
	);
	const todo = ACHIEVEMENTS.filter((a) => !done.has(a.code));
	if (!todo.length) return [];
	const s = playerStats(db, userId);
	const unlocked: Achievement[] = [];
	for (const a of todo) {
		if (!a.test(s)) continue;
		db.transaction(() => {
			const r = db
				.prepare('INSERT OR IGNORE INTO achievements_unlocked (user_id, code, unlocked_at) VALUES (?, ?, ?)')
				.run(userId, a.code, now);
			if (r.changes) {
				addKamas(db, userId, a.reward, `achievement:${a.code}`, now);
				addXp(db, userId, 25);
				notify(db, userId, 'achievement', `Succès débloqué : ${a.name} (+${a.reward} kamas)`, '/achievements', now);
				unlocked.push(a);
			}
		})();
	}
	return unlocked;
}

/** Début de la semaine en cours : lundi 00:00 heure de Bruxelles (comme les quêtes). */
export function weekStart(now = Date.now()) {
	const monday = brusselsWeek(now);
	return nextBrusselsMidnight(Date.parse(`${addDays(monday, -1)}T12:00:00Z`));
}

export function weeklyLeaderboard(db: DB, now = Date.now(), limit = 50) {
	return db
		.prepare(
			`SELECT u.id, u.username, u.xp, g.tag guild_tag,
				SUM(CASE WHEN e.kind = 'card' THEN e.points ELSE 0 END) card_points,
				SUM(CASE WHEN e.kind = 'duel' THEN e.points ELSE 0 END) duel_points,
				SUM(e.points) score
			 FROM score_events e JOIN users u ON u.id = e.user_id LEFT JOIN guilds g ON g.id = u.guild_id
			 WHERE e.created_at >= ? AND u.banned = 0
			 GROUP BY u.id ORDER BY score DESC, u.id LIMIT ?`
		)
		.all(weekStart(now), limit) as {
		id: number;
		username: string;
		xp: number;
		guild_tag: string | null;
		card_points: number;
		duel_points: number;
		score: number;
	}[];
}

export function guildLeaderboard(db: DB, now = Date.now(), limit = 20) {
	return db
		.prepare(
			`SELECT g.id, g.name, g.tag,
				(SELECT COUNT(*) FROM users m WHERE m.guild_id = g.id) members,
				COALESCE((SELECT SUM(e.points) FROM score_events e JOIN users u ON u.id = e.user_id WHERE u.guild_id = g.id AND e.created_at >= ?), 0)
				+ COALESCE((SELECT SUM(p.points) FROM guild_points p WHERE p.guild_id = g.id AND p.created_at >= ?), 0) score
			 FROM guilds g ORDER BY score DESC LIMIT ?`
		)
		.all(weekStart(now), weekStart(now), limit) as { id: number; name: string; tag: string; members: number; score: number }[];
}

/** Score de collection total (cartes différentes possédées, pondérées par rareté). */
export function collectionScore(db: DB, userId: number) {
	const rows = db
		.prepare('SELECT c.rarity, COUNT(DISTINCT c.id) n FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ? GROUP BY c.rarity')
		.all(userId) as { rarity: number; n: number }[];
	return rows.reduce((s, r) => s + COLLECTION_POINTS[r.rarity] * r.n, 0);
}

export function collectionLeaderboard(db: DB, limit = 50) {
	return db
		.prepare(
			`SELECT u.id, u.username, g.tag guild_tag,
				SUM(CASE c.rarity WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 5 WHEN 3 THEN 15 WHEN 4 THEN 40 ELSE 100 END) score,
				COUNT(*) distinct_cards
			 FROM (SELECT DISTINCT user_id, card_id FROM user_cards) uc
			 JOIN cards c ON c.id = uc.card_id JOIN users u ON u.id = uc.user_id LEFT JOIN guilds g ON g.id = u.guild_id
			 WHERE u.banned = 0 GROUP BY u.id ORDER BY score DESC LIMIT ?`
		)
		.all(limit) as { id: number; username: string; guild_tag: string | null; score: number; distinct_cards: number }[];
}
