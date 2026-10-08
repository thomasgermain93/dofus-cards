import type { DB } from '../db';
import { censor, isOffensiveName } from '../moderation';
import { assert, getUser, notify } from './core';

/* ---------------- Amis ---------------- */

export function findUserByName(db: DB, username: string) {
	return db.prepare('SELECT id, username, banned FROM users WHERE username = ?').get(username.trim()) as
		| { id: number; username: string; banned: number }
		| undefined;
}

export function friendshipStatus(db: DB, a: number, b: number): 'none' | 'friends' | 'sent' | 'received' {
	const r = db
		.prepare('SELECT user_id, status FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
		.get(a, b, b, a) as { user_id: number; status: string } | undefined;
	if (!r) return 'none';
	if (r.status === 'accepted') return 'friends';
	return r.user_id === a ? 'sent' : 'received';
}

export function sendFriendRequest(db: DB, fromId: number, toName: string, now = Date.now()) {
	const to = findUserByName(db, toName);
	assert(to && !to.banned, 'Aucun joueur avec ce pseudo.');
	assert(to.id !== fromId, 'Tu ne peux pas t’ajouter toi-même.');
	const st = friendshipStatus(db, fromId, to.id);
	assert(st !== 'friends', 'Vous êtes déjà amis.');
	assert(st !== 'sent', 'Demande déjà envoyée.');
	if (st === 'received') return acceptFriend(db, fromId, to.id, now);
	db.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(fromId, to.id, now);
	notify(db, to.id, 'friend', `${getUser(db, fromId).username} veut devenir ton ami.`, '/friends', now);
}

export function acceptFriend(db: DB, userId: number, requesterId: number, now = Date.now()) {
	const r = db
		.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'")
		.run(requesterId, userId);
	assert(r.changes === 1, 'Demande introuvable.');
	notify(db, requesterId, 'friend', `${getUser(db, userId).username} a accepté ta demande d’ami.`, '/friends', now);
}

export function removeFriend(db: DB, userId: number, otherId: number) {
	db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(
		userId,
		otherId,
		otherId,
		userId
	);
}

export function listFriends(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT u.id, u.username, u.xp, f.status, f.user_id requester
			 FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
			 WHERE (f.user_id = ? OR f.friend_id = ?) AND u.banned = 0 ORDER BY f.status, u.username`
		)
		.all(userId, userId, userId) as { id: number; username: string; xp: number; status: string; requester: number }[];
}

/* ---------------- Messagerie privée ---------------- */

export const MAX_MESSAGE = 500;

export function sendMessage(db: DB, fromId: number, toId: number, body: string, now = Date.now()) {
	const text = body.trim().slice(0, MAX_MESSAGE);
	assert(text.length > 0, 'Message vide.');
	const to = getUser(db, toId);
	assert(!to.banned, 'Ce joueur ne peut pas recevoir de messages.');
	assert(friendshipStatus(db, fromId, toId) === 'friends', 'Tu ne peux écrire qu’à tes amis.');
	db.prepare('INSERT INTO messages (from_id, to_id, body, created_at) VALUES (?, ?, ?, ?)').run(fromId, toId, censor(text), now);
}

export function conversation(db: DB, userId: number, otherId: number, now = Date.now()) {
	db.prepare('UPDATE messages SET read_at = ? WHERE to_id = ? AND from_id = ? AND read_at IS NULL').run(now, userId, otherId);
	return db
		.prepare(
			`SELECT * FROM (SELECT id, from_id, body, created_at FROM messages
			 WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY id DESC LIMIT 100) ORDER BY id`
		)
		.all(userId, otherId, otherId, userId) as { id: number; from_id: number; body: string; created_at: number }[];
}

export function inbox(db: DB, userId: number) {
	return db
		.prepare(
			`SELECT u.id, u.username, m.body, m.created_at,
				(SELECT COUNT(*) FROM messages x WHERE x.from_id = u.id AND x.to_id = ? AND x.read_at IS NULL) unread
			 FROM messages m JOIN users u ON u.id = CASE WHEN m.from_id = ? THEN m.to_id ELSE m.from_id END
			 WHERE m.id IN (SELECT MAX(id) FROM messages WHERE from_id = ? OR to_id = ? GROUP BY CASE WHEN from_id = ? THEN to_id ELSE from_id END)
			 ORDER BY m.id DESC`
		)
		.all(userId, userId, userId, userId, userId) as { id: number; username: string; body: string; created_at: number; unread: number }[];
}

/* ---------------- Guildes ---------------- */

export const GUILD_MAX_MEMBERS = 30;

export function createGuild(db: DB, userId: number, name: string, tag: string, description: string, now = Date.now()) {
	return db.transaction(() => {
		const n = name.trim();
		const t = tag.trim().toUpperCase();
		assert(/^[\p{L}\p{N} '-]{3,24}$/u.test(n), 'Nom de guilde : 3 à 24 caractères (lettres, chiffres, espaces).');
		assert(/^[A-Z0-9]{2,4}$/.test(t), 'Tag : 2 à 4 lettres ou chiffres.');
		assert(!isOffensiveName(n) && !isOffensiveName(t), 'Ce nom n’est pas autorisé.');
		const u = getUser(db, userId);
		assert(u.guild_id == null, 'Quitte d’abord ta guilde actuelle.');
		assert(!db.prepare('SELECT 1 FROM guilds WHERE name = ?').get(n), 'Ce nom de guilde est déjà pris.');
		const r = db
			.prepare('INSERT INTO guilds (name, tag, description, leader_id, created_at) VALUES (?, ?, ?, ?, ?)')
			.run(n, t, censor(description.trim().slice(0, 300)) || null, userId, now);
		const id = Number(r.lastInsertRowid);
		db.prepare('UPDATE users SET guild_id = ? WHERE id = ?').run(id, userId);
		return id;
	})();
}

export function joinGuild(db: DB, userId: number, guildId: number) {
	return db.transaction(() => {
		const u = getUser(db, userId);
		assert(u.guild_id == null, 'Quitte d’abord ta guilde actuelle.');
		assert(db.prepare('SELECT 1 FROM guilds WHERE id = ?').get(guildId), 'Guilde introuvable.');
		const n = (db.prepare('SELECT COUNT(*) n FROM users WHERE guild_id = ?').get(guildId) as { n: number }).n;
		assert(n < GUILD_MAX_MEMBERS, 'Cette guilde est complète.');
		db.prepare('UPDATE users SET guild_id = ? WHERE id = ?').run(guildId, userId);
	})();
}

/** Quitter : si le chef part, le plus ancien membre devient chef ; guilde vide = supprimée. */
export function leaveGuild(db: DB, userId: number) {
	return db.transaction(() => {
		const u = getUser(db, userId);
		assert(u.guild_id != null, 'Tu n’es dans aucune guilde.');
		const g = db.prepare('SELECT * FROM guilds WHERE id = ?').get(u.guild_id) as { id: number; leader_id: number };
		db.prepare('UPDATE users SET guild_id = NULL WHERE id = ?').run(userId);
		if (g.leader_id === userId) {
			const next = db.prepare('SELECT id FROM users WHERE guild_id = ? ORDER BY created_at LIMIT 1').get(g.id) as { id: number } | undefined;
			if (next) db.prepare('UPDATE guilds SET leader_id = ? WHERE id = ?').run(next.id, g.id);
			else db.prepare('DELETE FROM guilds WHERE id = ?').run(g.id);
		}
	})();
}

export function kickFromGuild(db: DB, leaderId: number, memberId: number) {
	const leader = getUser(db, leaderId);
	const g = db.prepare('SELECT leader_id FROM guilds WHERE id = ?').get(leader.guild_id) as { leader_id: number } | undefined;
	assert(g && g.leader_id === leaderId, 'Seul le chef peut exclure un membre.');
	assert(memberId !== leaderId, 'Utilise « Quitter la guilde ».');
	const r = db.prepare('UPDATE users SET guild_id = NULL WHERE id = ? AND guild_id = ?').run(memberId, leader.guild_id);
	assert(r.changes === 1, 'Membre introuvable.');
}

export function transferLeadership(db: DB, leaderId: number, memberId: number) {
	const leader = getUser(db, leaderId);
	const member = getUser(db, memberId);
	const g = db.prepare('SELECT leader_id FROM guilds WHERE id = ?').get(leader.guild_id) as { leader_id: number } | undefined;
	assert(g && g.leader_id === leaderId && member.guild_id === leader.guild_id, 'Action impossible.');
	db.prepare('UPDATE guilds SET leader_id = ? WHERE id = ?').run(memberId, leader.guild_id);
}

export function postGuildMessage(db: DB, userId: number, body: string, now = Date.now()) {
	const u = getUser(db, userId);
	assert(u.guild_id != null, 'Tu n’es dans aucune guilde.');
	const text = body.trim().slice(0, MAX_MESSAGE);
	assert(text.length > 0, 'Message vide.');
	db.prepare('INSERT INTO guild_messages (guild_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').run(u.guild_id, userId, censor(text), now);
}
