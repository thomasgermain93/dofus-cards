/**
 * Crée (ou met à jour le mot de passe et le rôle d') un compte.
 *   npm run user:create -- <pseudo> <mot de passe> [admin]
 */
import Database from 'better-sqlite3';
import { hash } from '@node-rs/argon2';
import { join } from 'node:path';
import { migrate } from '../src/lib/server/db/schema.ts';

const [username, password, role = 'player'] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
	console.error('Usage : npm run user:create -- <pseudo> <mot de passe (8 car. min)> [admin]');
	process.exit(1);
}
const db = new Database(join(process.env.DATA_DIR ?? './data', 'game.db'));
migrate(db);
const h = await hash(password);
const now = Date.now();
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
if (existing) {
	db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(h, role, existing.id);
	console.log(`Compte ${username} mis à jour (${role}).`);
} else {
	db.prepare('INSERT INTO users (username, password_hash, role, kamas, pack_stock, pack_anchor, created_at) VALUES (?, ?, ?, 100, 3, ?, ?)').run(username, h, role, now, now);
	console.log(`Compte ${username} créé (${role}).`);
}
db.close();
