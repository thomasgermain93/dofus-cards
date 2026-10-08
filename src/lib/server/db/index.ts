import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from './schema';

export type DB = Database.Database;

let instance: DB | null = null;

export function dataDir() {
	return process.env.DATA_DIR ?? './data';
}

/** Base SQLite unique du processus (créée et migrée au premier appel). */
export function getDb(): DB {
	if (instance) return instance;
	mkdirSync(dataDir(), { recursive: true });
	instance = new Database(join(dataDir(), 'game.db'));
	setup(instance);
	return instance;
}

/** Base en mémoire, pour les tests. */
export function memoryDb(): DB {
	const db = new Database(':memory:');
	setup(db);
	return db;
}

/** Minuscules sans accents, pour la recherche (« écaflip » trouve « Ecaflip »). */
export const norm = (s: unknown) =>
	String(s ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

function setup(db: DB) {
	migrate(db);
	db.function('norm', { deterministic: true }, (s: unknown) => norm(s));
}
