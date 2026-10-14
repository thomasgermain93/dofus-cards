import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { DB } from './db';
import { STARTING_KAMAS, STARTING_PACKS } from './game/constants';
import { assert } from './game/core';
import { isOffensiveName } from './moderation';

export const SESSION_COOKIE = 'dc_session';
export const SESSION_DAYS = 30;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export function validateUsername(name: string) {
	assert(/^[A-Za-z0-9_-]{3,20}$/.test(name), 'Pseudo : 3 à 20 caractères (lettres, chiffres, - et _).');
	assert(!isOffensiveName(name), 'Ce pseudo n’est pas autorisé.');
	assert(!/^(admin|moderat|ankama|ordinateur|system)/i.test(name), 'Ce pseudo est réservé.');
}

export async function createUser(db: DB, username: string, password: string, role = 'player', now = Date.now()) {
	validateUsername(username);
	assert(password.length >= 8 && password.length <= 200, 'Mot de passe : 8 caractères minimum.');
	assert(!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username), 'Ce pseudo est déjà pris.');
	const passwordHash = await hash(password);
	const r = db
		.prepare(
			'INSERT INTO users (username, password_hash, role, kamas, pack_stock, pack_anchor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
		.run(username, passwordHash, role, STARTING_KAMAS, STARTING_PACKS, now, now);
	return Number(r.lastInsertRowid);
}

export async function checkLogin(db: DB, username: string, password: string) {
	const u = db.prepare('SELECT id, password_hash, banned, ban_reason FROM users WHERE username = ?').get(username.trim()) as
		| { id: number; password_hash: string; banned: number; ban_reason: string | null }
		| undefined;
	// Vérification factice si le compte n'existe pas (temps de réponse constant).
	const ok = u ? await verify(u.password_hash, password) : (await hash('x'), false);
	assert(u && ok, 'Pseudo ou mot de passe incorrect.');
	assert(!u.banned, `Ce compte est suspendu${u.ban_reason ? ` : ${u.ban_reason}` : '.'}`);
	return u.id;
}

export function createSession(db: DB, userId: number, now = Date.now()) {
	const token = randomBytes(32).toString('base64url');
	const expires = now + SESSION_DAYS * 86_400_000;
	db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, expires);
	return { token, expires: new Date(expires) };
}

export function sessionUser(db: DB, token: string | undefined, now = Date.now()) {
	if (!token) return null;
	const row = db
		.prepare(
			`SELECT u.id, u.username, u.role, u.banned, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
		)
		.get(sha(token)) as { id: number; username: string; role: string; banned: number; expires_at: number } | undefined;
	if (!row || row.expires_at < now || row.banned) return null;
	return { id: row.id, username: row.username, role: row.role };
}

export function destroySession(db: DB, token: string | undefined) {
	if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(sha(token));
}

export function purgeSessions(db: DB, now = Date.now()) {
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}
