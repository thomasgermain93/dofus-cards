import { memoryDb, type DB } from '../db';
import { STARTING_KAMAS } from '../game/constants';

/** Base de test : 6 raretés x 4 catégories x 5 cartes, avec des faits pour le quiz. */
export function testDb(): DB {
	const db = memoryDb();
	const ins = db.prepare(
		`INSERT INTO cards (key, source_id, category, subtype, name, level, rarity, attack, defense, info1, facts, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
	);
	let n = 0;
	const zones = ['Astrub', 'Amakna', 'Bonta', 'Brâkmar', 'Frigost'];
	const sets = ['Panoplie du Bouftou', 'Panoplie du Tofu', 'Panoplie Aventurière', 'Panoplie du Craqueleur'];
	for (let rarity = 0; rarity < 6; rarity++) {
		for (const category of ['monster', 'item', 'mount', 'class']) {
			for (let i = 0; i < 5; i++) {
				n++;
				const facts =
					category === 'monster'
						? { level: 10 * (i + 1), zone: zones[i], race: `Race ${i}`, dungeon: `Donjon ${i}` }
						: category === 'item'
							? { level: 20 * (i + 1), type: ['Chapeau', 'Cape', 'Anneau', 'Amulette', 'Bottes'][i], set: sets[i % 4] }
							: category === 'mount'
								? { level: 60, family: ['Dragodinde', 'Muldo', 'Volkorne', 'Montilier', 'Dragodinde'][i] }
								: { role: ['Protecteur', 'Soigneur', 'Tireur', 'Guerrier', 'Invocateur'][i], spells: [`Sort ${n}a`, `Sort ${n}b`] };
				ins.run(`${category}:${n}`, n, category, category, `Carte ${n}`, 10 * (i + 1), rarity, 1000 + 100 * n, 2000 + 50 * n, null, JSON.stringify(facts));
			}
		}
	}
	return db;
}

export function addUser(db: DB, username: string, kamas = STARTING_KAMAS, now = 0) {
	const r = db
		.prepare('INSERT INTO users (username, password_hash, kamas, pack_stock, pack_anchor, created_at) VALUES (?, ?, ?, 3, ?, ?)')
		.run(username, 'x', kamas, now, now);
	return Number(r.lastInsertRowid);
}

export function give(db: DB, userId: number, cardId: number, times = 1) {
	for (let i = 0; i < times; i++)
		db.prepare('INSERT INTO user_cards (user_id, card_id, obtained_at) VALUES (?, ?, 0)').run(userId, cardId);
}

export const kamas = (db: DB, id: number) => (db.prepare('SELECT kamas FROM users WHERE id = ?').get(id) as { kamas: number }).kamas;
export const copies = (db: DB, userId: number, cardId: number) =>
	(db.prepare('SELECT COUNT(*) n FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId) as { n: number }).n;

export function befriend(db: DB, a: number, b: number) {
	db.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', 0)").run(a, b);
}
