import type { DB } from '../db';
import { SELL_VALUES } from './constants';
import { addKamas, assert, grantCard, notify } from './core';
import { addFragments } from './quests';
import type { Rng } from './rng';

/**
 * Collections thématiques (sous-albums) calculées depuis les données des cartes :
 * régions (monstres), donjons (monstres et boss), panoplies (objets).
 */

export type CollectionKind = 'region' | 'donjon' | 'panoplie';

export interface CollectionDef {
	key: string;
	kind: CollectionKind;
	name: string;
	cardIds: number[];
	rarities: number[];
}

export const KIND_LABEL: Record<CollectionKind, string> = { region: 'Région', donjon: 'Donjon', panoplie: 'Panoplie' };
const MIN_SIZE: Record<CollectionKind, number> = { region: 5, donjon: 3, panoplie: 3 };

const cache = new WeakMap<object, CollectionDef[]>();

export function allCollections(db: DB): CollectionDef[] {
	const hit = cache.get(db);
	if (hit) return hit;
	const rows = db.prepare('SELECT id, category, rarity, facts FROM cards WHERE active = 1').all() as {
		id: number;
		category: string;
		rarity: number;
		facts: string;
	}[];
	const groups = new Map<string, CollectionDef>();
	const add = (kind: CollectionKind, name: string | null | undefined, id: number, rarity: number) => {
		if (!name) return;
		const key = `${kind}:${name}`;
		const g = groups.get(key) ?? { key, kind, name, cardIds: [], rarities: [] };
		if (!g.cardIds.includes(id)) {
			g.cardIds.push(id);
			g.rarities.push(rarity);
		}
		groups.set(key, g);
	};
	for (const r of rows) {
		const f = JSON.parse(r.facts || '{}');
		if (r.category === 'monster') {
			add('region', f.area, r.id, r.rarity);
			add('donjon', f.bossOf ?? f.dungeon, r.id, r.rarity);
		} else if (r.category === 'item') add('panoplie', f.set, r.id, r.rarity);
	}
	const list = [...groups.values()]
		.filter((g) => g.cardIds.length >= MIN_SIZE[g.kind])
		.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'fr'));
	cache.set(db, list);
	return list;
}

export function resetCollectionsCache(db: DB) {
	cache.delete(db);
}

/** Récompense d'une collection complète : kamas selon la taille et la rareté, fragments, carte brillante, titre. */
export function collectionReward(c: CollectionDef) {
	const kamas = Math.min(2000, 15 * c.cardIds.length + c.rarities.reduce((s, r) => s + SELL_VALUES[r] * 2, 0));
	const fragments = 10 * c.cardIds.length;
	const title = c.kind === 'region' ? `Explorateur de ${c.name}` : c.kind === 'donjon' ? `Vainqueur de ${c.name}` : null;
	return { kamas, fragments, title, shiny: true };
}

export function userCollections(db: DB, userId: number) {
	const owned = new Set(
		(db.prepare('SELECT DISTINCT card_id FROM user_cards WHERE user_id = ?').all(userId) as { card_id: number }[]).map((r) => r.card_id)
	);
	const claimed = new Set(
		(db.prepare('SELECT key FROM collections_claimed WHERE user_id = ?').all(userId) as { key: string }[]).map((r) => r.key)
	);
	return allCollections(db).map((c) => {
		const have = c.cardIds.filter((id) => owned.has(id)).length;
		return { ...c, have, total: c.cardIds.length, complete: have === c.cardIds.length, claimed: claimed.has(c.key), reward: collectionReward(c) };
	});
}

export function claimCollection(db: DB, userId: number, key: string, rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		const c = allCollections(db).find((x) => x.key === key);
		assert(c, 'Collection introuvable.');
		assert(!db.prepare('SELECT 1 FROM collections_claimed WHERE user_id = ? AND key = ?').get(userId, key), 'Récompense déjà récupérée.');
		const ownedStmt = db.prepare('SELECT 1 FROM user_cards WHERE user_id = ? AND card_id = ? LIMIT 1');
		const missing = c.cardIds.filter((id) => !ownedStmt.get(userId, id)).length;
		assert(missing === 0, `Il te manque encore ${missing} carte${missing > 1 ? 's' : ''}.`);
		const reward = collectionReward(c);
		db.prepare('INSERT INTO collections_claimed (user_id, key, claimed_at) VALUES (?, ?, ?)').run(userId, key, now);
		addKamas(db, userId, reward.kamas, `collection:${key}`, now);
		addFragments(db, userId, reward.fragments);
		// Une carte brillante de la collection, au hasard
		const shinyCard = c.cardIds[Math.floor(rng() * c.cardIds.length)];
		grantCard(db, userId, shinyCard, now, false, true);
		if (reward.title) db.prepare('UPDATE users SET title = ? WHERE id = ?').run(reward.title, userId);
		notify(db, userId, 'collection', `Collection complétée : ${c.name} ! +${reward.kamas} kamas et une carte brillante.`, '/collections', now);
		return { ...reward, shinyCard };
	})();
}
