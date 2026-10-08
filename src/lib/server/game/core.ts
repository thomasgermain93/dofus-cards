import type { DB } from '../db';
import { COLLECTION_POINTS, XP } from './constants';

/** Erreur « métier » dont le message peut être montré au joueur. */
export class GameError extends Error {}

export function assert(cond: unknown, message: string): asserts cond {
	if (!cond) throw new GameError(message);
}

export interface CardRow {
	id: number;
	key: string;
	category: string;
	subtype: string;
	name: string;
	image: string | null;
	level: number;
	rarity: number;
	attack: number;
	defense: number;
	info1: string | null;
	info2: string | null;
	flavor?: string | null;
	facts: string;
}

export interface UserRow {
	id: number;
	username: string;
	role: string;
	banned: number;
	kamas: number;
	xp: number;
	pack_stock: number;
	pack_anchor: number;
	daily_last: string | null;
	daily_streak: number;
	guild_id: number | null;
	bio: string | null;
	created_at: number;
}

export function getUser(db: DB, id: number): UserRow {
	const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
	assert(u, 'Joueur introuvable.');
	return u;
}

export function getCard(db: DB, id: number): CardRow {
	const c = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
	assert(c, 'Carte introuvable.');
	return c;
}

/** Ajoute (ou retire si négatif) des kamas, sans jamais passer sous zéro. */
export function addKamas(db: DB, userId: number, delta: number, reason: string, now = Date.now()) {
	if (delta === 0) return;
	const r = db
		.prepare('UPDATE users SET kamas = kamas + ? WHERE id = ? AND kamas + ? >= 0')
		.run(delta, userId, delta);
	assert(r.changes === 1, 'Pas assez de kamas.');
	db.prepare('INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').run(
		userId,
		delta,
		reason,
		now
	);
}

export function addXp(db: DB, userId: number, amount: number) {
	db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId);
}

export function notify(db: DB, userId: number, kind: string, body: string, link: string | null = null, now = Date.now()) {
	db.prepare('INSERT INTO notifications (user_id, kind, body, link, created_at) VALUES (?, ?, ?, ?, ?)').run(
		userId,
		kind,
		body,
		link,
		now
	);
}

/** Nombre d'exemplaires d'une carte possédés et non bloqués (enchère). */
export function freeCopies(db: DB, userId: number, cardId: number): number[] {
	return (
		db
			.prepare('SELECT id FROM user_cards WHERE user_id = ? AND card_id = ? AND locked IS NULL ORDER BY id')
			.all(userId, cardId) as { id: number }[]
	).map((r) => r.id);
}

export function ownsCard(db: DB, userId: number, cardId: number): boolean {
	return !!db.prepare('SELECT 1 FROM user_cards WHERE user_id = ? AND card_id = ? LIMIT 1').get(userId, cardId);
}

/**
 * Donne une carte à un joueur. Si c'est une carte qu'il n'avait pas, il gagne
 * des points de collection (classement hebdomadaire) et de l'XP.
 */
export function grantCard(db: DB, userId: number, cardId: number, now = Date.now(), countScore = true): { isNew: boolean } {
	const isNew = !ownsCard(db, userId, cardId);
	db.prepare('INSERT INTO user_cards (user_id, card_id, obtained_at) VALUES (?, ?, ?)').run(userId, cardId, now);
	if (isNew && countScore) {
		const { rarity } = db.prepare('SELECT rarity FROM cards WHERE id = ?').get(cardId) as { rarity: number };
		db.prepare('INSERT INTO score_events (user_id, kind, points, created_at) VALUES (?, ?, ?, ?)').run(
			userId,
			'card',
			COLLECTION_POINTS[rarity],
			now
		);
		addXp(db, userId, XP.newCard);
	}
	return { isNew };
}

/**
 * Transfère un exemplaire précis d'un joueur à un autre (même ligne, nouveau
 * propriétaire). Pas de points de classement pour les cartes échangées ou
 * achetées : évite que deux comptes complices gonflent leur score.
 */
export function moveCopy(db: DB, userCardId: number, toUserId: number, now = Date.now()) {
	const r = db
		.prepare('UPDATE user_cards SET user_id = ?, locked = NULL, obtained_at = ? WHERE id = ?')
		.run(toUserId, now, userCardId);
	assert(r.changes === 1, 'Exemplaire introuvable.');
}

export const parseIds = (json: string | null | undefined): number[] => {
	try {
		const v = JSON.parse(json ?? '[]');
		return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
	} catch {
		return [];
	}
};
