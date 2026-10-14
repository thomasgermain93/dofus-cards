import type { DB } from './db';
import { CARD_COLS } from './web';
import type { CardView } from '#lib/types';

/** Cartes possédées (une ligne par carte) avec le nombre d'exemplaires libres. */
export function ownedCards(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT ${CARD_COLS}, COUNT(*) total, SUM(uc.locked IS NULL) free
			 FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ?
			 GROUP BY c.id ORDER BY c.rarity DESC, c.attack DESC`
		)
		.all(userId) as (CardView & { total: number; free: number })[];
}

export function cardsByIds(db: DB, ids: number[]) {
	if (!ids.length) return [];
	const rows = db.prepare(`SELECT ${CARD_COLS} FROM cards c WHERE c.id IN (${ids.map(() => '?').join(',')})`).all(...ids) as CardView[];
	const map = new Map(rows.map((r) => [r.id, r]));
	return ids.map((id) => map.get(id)).filter((c): c is CardView => !!c);
}

export function friendsOf(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT u.id, u.username FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
			 WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' AND u.banned = 0 ORDER BY u.username`
		)
		.all(userId, userId, userId) as { id: number; username: string }[];
}

import { dailyStatus, chestStatus } from './game/retention';
import { listQuests } from './game/quests';
import { boosterCounts } from './game/packs';
import { userCollections } from './game/collections';
import { getUser } from './game/core';
import { BOOSTERS } from './game/constants';
import { nextBrusselsMidnight, nextBrusselsMonday } from './game/time';

/** Tout ce qui fait revenir le joueur : série, quêtes, coffre, boosters, collections à réclamer. */
export function retentionSummary(db: DB, userId: number, now = Date.now()) {
	const quests = listQuests(db, userId, now);
	const collections = userCollections(db, userId);
	return {
		daily: dailyStatus(db, userId, now),
		quests,
		questsToClaim: quests.filter((q) => q.done && !q.claimed_at).length,
		chest: chestStatus(db, userId, now),
		boosters: boosterCounts(db, userId),
		boosterNames: Object.fromEntries(Object.entries(BOOSTERS).map(([k, v]) => [k, v.name])) as Record<string, string>,
		fragments: getUser(db, userId).fragments,
		collectionsToClaim: collections.filter((c) => c.complete && !c.claimed).length,
		nextMidnight: nextBrusselsMidnight(now),
		nextMonday: nextBrusselsMonday(now),
		now
	};
}

import { showcasePreviews } from './game/profile';

export interface UserBrief {
	id: number;
	username: string;
	title: string | null;
	avatar: string | null;
	avatarX: number;
	avatarY: number;
	showcase: CardView[];
}

/** Infos d'affichage d'un ou plusieurs joueurs : avatar-carte, titre, aperçu de la vitrine principale. */
export function userBriefs(db: DB, ids: number[]): Map<number, UserBrief> {
	const out = new Map<number, UserBrief>();
	const uniq = [...new Set(ids.filter((x) => Number.isFinite(x)))];
	if (!uniq.length) return out;
	const rows = db
		.prepare(
			`SELECT u.id, u.username, u.title, c.image avatar, u.avatar_x, u.avatar_y FROM users u LEFT JOIN cards c ON c.id = u.avatar_card_id
			 WHERE u.id IN (${uniq.map(() => '?').join(',')})`
		)
		.all(...uniq) as { id: number; username: string; title: string | null; avatar: string | null; avatar_x: number; avatar_y: number }[];
	const previews = showcasePreviews(db, uniq);
	const allCards = cardsByIds(db, [...new Set([...previews.values()].flat())]);
	const byId = new Map(allCards.map((c) => [c.id, c]));
	for (const r of rows)
		out.set(r.id, {
			id: r.id,
			username: r.username,
			title: r.title,
			avatar: r.avatar,
			avatarX: r.avatar_x,
			avatarY: r.avatar_y,
			showcase: (previews.get(r.id) ?? []).map((id) => byId.get(id)).filter((c): c is CardView => !!c)
		});
	return out;
}
