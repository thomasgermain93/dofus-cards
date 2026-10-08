/**
 * Import du dataset DofusDB -> cartes du jeu.
 *
 *   npm run import:dofusdb            (utilise le cache des réponses API s'il existe)
 *   npm run import:dofusdb -- --refresh   (re-télécharge tout depuis l'API)
 *
 * Relançable : les cartes sont mises à jour par leur clé (monster:58...), les
 * collections des joueurs restent valides. Les images sont copiées une fois dans
 * DATA_DIR/images (aucun lien direct vers DofusDB au moment du jeu).
 */
import Database from 'better-sqlite3';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { migrate } from '../src/lib/server/db/schema.ts';
import {
	percentileRanks,
	rarityFromPercentile,
	finalStat,
	monsterRawAttack,
	monsterRawDefense,
	monsterPrestige,
	itemRawStats,
	itemPrestige,
	mountPrestige,
	CLASS_PRESTIGE,
	RARITIES,
	type ItemEffect
} from '../src/lib/server/cards/formulas.ts';

const API = 'https://api.dofusdb.fr';
const DATA_DIR = process.env.DATA_DIR ?? './data';
const RAW_DIR = join(DATA_DIR, 'raw');
const IMG_DIR = join(DATA_DIR, 'images');
const REFRESH = process.argv.includes('--refresh');
const SKIP_IMAGES = process.argv.includes('--no-images');
const UA = 'DofusCards-import/1.0 (fan-jeu gratuit, contact thomas@hungrynuggets.com)';

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(IMG_DIR, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, tries = 4): Promise<any> {
	for (let t = 1; ; t++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': UA } });
			if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
			return await res.json();
		} catch (e) {
			if (t >= tries) throw e;
			await sleep(800 * t);
		}
	}
}

/** Télécharge toutes les pages d'un endpoint (50 par page), avec cache disque. */
async function fetchAll(name: string, endpoint: string, params: [string, string][] = []) {
	const cache = join(RAW_DIR, `${name}.json`);
	if (!REFRESH && existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as any[];
	const build = (skip: number) => {
		const q = new URLSearchParams(params);
		q.set('$limit', '50');
		q.set('$skip', String(skip));
		return `${API}/${endpoint}?${q}`;
	};
	const first = await getJson(build(0));
	const total: number = first.total;
	const out: any[] = [...first.data];
	const skips: number[] = [];
	for (let s = 50; s < total; s += 50) skips.push(s);
	const CONC = 4;
	for (let i = 0; i < skips.length; i += CONC) {
		const pages = await Promise.all(skips.slice(i, i + CONC).map((s) => getJson(build(s))));
		for (const p of pages) out.push(...p.data);
	}
	writeFileSync(cache, JSON.stringify(out));
	console.log(`  ${name}: ${out.length}/${total}`);
	return out;
}

const fr = (o: any): string => (o && typeof o === 'object' ? (o.fr ?? '') : '').trim();

/* --- Catégories d'objets retenues (typeId DofusDB) --- */
const EQUIPMENT_TYPES = [1, 9, 10, 11, 16, 17, 82]; // amulette, anneau, ceinture, bottes, chapeau, cape, bouclier
const WEAPON_TYPES = [2, 3, 4, 5, 6, 7, 8, 19, 22, 271]; // arcs, baguettes, bâtons, dagues, épées, marteaux, pelles, haches, faux, lances
const PET_TYPES = [18];
const DOFUS_TYPES = [23, 217]; // Dofus, Prysmaradite
const MOUNT_TYPES = [331, 332, 333, 121]; // Dragodinde, Muldo, Volkorne, Montilier
const ITEM_TYPES = [...EQUIPMENT_TYPES, ...WEAPON_TYPES, ...PET_TYPES, ...DOFUS_TYPES, ...MOUNT_TYPES];

interface CardDraft {
	key: string;
	source_id: number;
	category: 'monster' | 'item' | 'mount' | 'class';
	subtype: string;
	name: string;
	imageUrl: string | null;
	image: string | null;
	level: number;
	info1: string | null;
	info2: string | null;
	facts: Record<string, unknown>;
	rawAtk: number;
	rawDef: number;
	prestige: number;
	rarity?: number;
	attack?: number;
	defense?: number;
}

async function main() {
	console.log('1/4 Téléchargement des données DofusDB');
	const typeParams: [string, string][] = ITEM_TYPES.map((t) => ['typeId[$in][]', String(t)]);
	const [monsters, items, itemSets, subareas, areas, races, dungeons, breeds, effects, itemTypes] =
		await Promise.all([
			fetchAll('monsters', 'monsters', [
				['isQuestMonster', 'false'],
				...['id', 'name', 'grades', 'subareas', 'race', 'isBoss', 'isMiniBoss', 'correspondingMiniBossId', 'gfxId', 'hideInBestiary', 'img'].map(
					(f) => ['$select[]', f] as [string, string]
				)
			]),
			fetchAll('items', 'items', [
				...typeParams,
				...['id', 'name', 'typeId', 'iconId', 'level', 'itemSetId', 'effects', 'isLegendary', 'dropMonsterIds', 'img'].map(
					(f) => ['$select[]', f] as [string, string]
				)
			]),
			fetchAll('item-sets', 'item-sets', [['$select[]', 'id'], ['$select[]', 'name'], ['$select[]', 'level']]),
			fetchAll('subareas', 'subareas', [['$select[]', 'id'], ['$select[]', 'name'], ['$select[]', 'areaId']]),
			fetchAll('areas', 'areas', [['$select[]', 'id'], ['$select[]', 'name']]),
			fetchAll('monster-races', 'monster-races', [['$select[]', 'id'], ['$select[]', 'name']]),
			fetchAll('dungeons', 'dungeons', [
				['$select[]', 'id'], ['$select[]', 'name'], ['$select[]', 'bosses'], ['$select[]', 'monsters'], ['$select[]', 'subarea'], ['$select[]', 'optimalPlayerLevel']
			]),
			fetchAll('breeds', 'breeds'),
			fetchAll('effects', 'effects', [['$select[]', 'id'], ['$select[]', 'bonusType'], ['$select[]', 'category'], ['$select[]', 'characteristic']]),
			fetchAll('item-types', 'item-types', [['$select[]', 'id'], ['$select[]', 'name']])
		]);

	// Sorts des classes (3 premiers sorts de chaque classe, pour le quiz)
	const spellIds = breeds.flatMap((b: any) => (b.breedSpellsId ?? []).slice(0, 3));
	const spells: any[] = [];
	for (let i = 0; i < spellIds.length; i += 40) {
		const chunk = spellIds.slice(i, i + 40);
		spells.push(
			...(await fetchAll(`spells-${i}`, 'spells', [
				...chunk.map((id: number) => ['id[$in][]', String(id)] as [string, string]),
				['$select[]', 'id'], ['$select[]', 'name']
			]))
		);
	}

	const byId = <T extends { id: number }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
	const subareaMap = byId(subareas);
	const areaMap = byId(areas);
	const raceMap = byId(races);
	const setMap = byId(itemSets);
	const typeMap = byId(itemTypes);
	const effectMap = byId(effects);
	const spellMap = byId(spells);
	const monsterMap = byId(monsters);

	const dungeonOfMonster = new Map<number, any>();
	const dungeonOfBoss = new Map<number, any>();
	for (const d of dungeons) {
		for (const m of d.monsters ?? []) if (!dungeonOfMonster.has(m)) dungeonOfMonster.set(m, d);
		for (const b of d.bosses ?? []) dungeonOfBoss.set(b, d);
	}
	const archiBase = new Map<number, any>();
	for (const m of monsters) if (m.correspondingMiniBossId) archiBase.set(m.correspondingMiniBossId, m);

	console.log('2/4 Calcul des cartes');
	const drafts: CardDraft[] = [];
	const seenNames = new Set<string>();

	/* --- Monstres --- */
	for (const m of monsters) {
		const name = fr(m.name);
		if (!name || name.startsWith('[') || !m.grades?.length) continue;
		const boss = !!m.isBoss || dungeonOfBoss.has(m.id);
		const archi = !!m.isMiniBoss;
		const dungeon = dungeonOfBoss.get(m.id) ?? dungeonOfMonster.get(m.id);
		if (!(m.subareas?.length || boss || dungeon)) continue;
		if (m.hideInBestiary && !boss) continue;
		const key = `m:${name}`;
		if (seenNames.has(key)) continue;
		seenNames.add(key);
		const g = m.grades[m.grades.length - 1];
		const sub = subareaMap.get(m.subareas?.[0]) ?? (dungeon ? subareaMap.get(dungeon.subarea) : undefined);
		const area = sub ? areaMap.get(sub.areaId) : undefined;
		const zone = sub ? fr(sub.name) : null;
		const race = fr(raceMap.get(m.race)?.name) || null;
		const base = archi ? archiBase.get(m.id) : undefined;
		const subtype = boss ? 'Boss' : archi ? 'Archimonstre' : 'Monstre';
		const info2 = boss && dungeonOfBoss.get(m.id)
			? `Boss : ${fr(dungeonOfBoss.get(m.id).name)}`
			: base
				? `Archimonstre de ${fr(base.name)}`
				: dungeon
					? `Donjon : ${fr(dungeon.name)}`
					: race;
		drafts.push({
			key: `monster:${m.id}`,
			source_id: m.id,
			category: 'monster',
			subtype,
			name,
			imageUrl: m.gfxId ? `${API}/img/monsters/${m.gfxId}.png` : null,
			image: m.gfxId ? `monsters/${m.gfxId}.png` : null,
			level: g.level ?? 0,
			info1: zone ? (area && fr(area.name) !== zone ? `${zone}, ${fr(area.name)}` : zone) : null,
			info2,
			facts: {
				level: g.level,
				zone,
				area: area ? fr(area.name) : null,
				race,
				dungeon: dungeon ? fr(dungeon.name) : null,
				bossOf: dungeonOfBoss.get(m.id) ? fr(dungeonOfBoss.get(m.id).name) : null,
				archiOf: base ? fr(base.name) : null,
				hp: g.lifePoints
			},
			rawAtk: monsterRawAttack(g),
			rawDef: monsterRawDefense(g),
			prestige: 0
		});
	}
	// Prestige monstres (besoin du percentile de PV)
	{
		const ms = drafts.filter((d) => d.category === 'monster');
		const hpP = percentileRanks(ms.map((d) => Math.log1p((d.facts.hp as number) ?? 1)));
		ms.forEach((d, i) => {
			d.prestige = monsterPrestige({
				level: d.level,
				isBoss: d.subtype === 'Boss',
				isArchi: d.subtype === 'Archimonstre',
				inDungeon: !!d.facts.dungeon,
				hpPercentile: hpP[i]
			});
		});
	}

	/* --- Objets et montures --- */
	const toEffects = (list: any[]): ItemEffect[] =>
		(list ?? []).map((e) => {
			const def = effectMap.get(e.effectId);
			return {
				characteristic: e.characteristic,
				from: e.from ?? 0,
				to: e.to ?? 0,
				category: def?.category ?? e.category,
				bonusType: def?.bonusType
			};
		});
	const seenItem = new Set<string>();
	for (const it of items) {
		const name = fr(it.name);
		if (!name || name.startsWith('[') || /obsol[eè]te/i.test(name)) continue;
		if (!it.level || !it.iconId) continue;
		const isMount = MOUNT_TYPES.includes(it.typeId);
		const dedupe = `${isMount ? 'mt' : 'it'}:${name}`;
		if (seenItem.has(dedupe)) continue;
		seenItem.add(dedupe);
		const typeName = fr(typeMap.get(it.typeId)?.name) || 'Objet';
		const set = it.itemSetId > 0 ? setMap.get(it.itemSetId) : undefined;
		const dropMonster = (it.dropMonsterIds ?? []).map((id: number) => monsterMap.get(id)).find((m: any) => m && fr(m.name));
		const { atk, def } = itemRawStats(it.level, toEffects(it.effects));
		if (isMount) {
			const family = it.typeId === 121 ? 'Montilier' : typeName;
			drafts.push({
				key: `mount:${it.id}`,
				source_id: it.id,
				category: 'mount',
				subtype: family,
				name,
				imageUrl: `${API}/img/items/${it.iconId}.png`,
				image: `items/${it.iconId}.png`,
				level: it.level,
				info1: family === 'Montilier' ? 'Montilier' : `Famille : ${family}`,
				info2: name.includes(' et ') ? 'Bicolore' : null,
				facts: { level: it.level, family },
				rawAtk: atk,
				rawDef: def,
				prestige: mountPrestige({
					level: it.level,
					family,
					isBicolor: name.includes(' et '),
					isMontilier: it.typeId === 121
				})
			});
			continue;
		}
		const isDofus = it.typeId === 23;
		const isPrysma = it.typeId === 217;
		const subtype = typeName;
		drafts.push({
			key: `item:${it.id}`,
			source_id: it.id,
			category: 'item',
			subtype,
			name,
			imageUrl: `${API}/img/items/${it.iconId}.png`,
			image: `items/${it.iconId}.png`,
			level: it.level,
			info1: set ? fr(set.name) : WEAPON_TYPES.includes(it.typeId) ? 'Arme' : isDofus || isPrysma ? 'Œuf mythique' : null,
			info2: dropMonster ? `Butin : ${fr(dropMonster.name)}` : null,
			facts: {
				level: it.level,
				type: typeName,
				set: set ? fr(set.name) : null,
				dropMonster: dropMonster ? fr(dropMonster.name) : null,
				isDofus,
				isPrysma,
				isLegendary: !!it.isLegendary,
				isPet: PET_TYPES.includes(it.typeId)
			},
			rawAtk: atk,
			rawDef: def,
			prestige: 0
		});
	}
	{
		const its = drafts.filter((d) => d.category === 'item');
		const pw = percentileRanks(its.map((d) => Math.log1p(d.rawAtk + d.rawDef)));
		its.forEach((d, i) => {
			d.prestige = itemPrestige({
				level: d.level,
				isDofus: !!d.facts.isDofus,
				isPrysmaradite: !!d.facts.isPrysma,
				isLegendary: !!d.facts.isLegendary,
				inSet: !!d.facts.set,
				isPet: !!d.facts.isPet,
				powerPercentile: pw[i]
			});
		});
	}

	/* --- Classes --- */
	for (const b of breeds) {
		const name = fr(b.shortName);
		if (!name) continue;
		const roleOf = (word: RegExp) =>
			(b.breedRoles ?? []).filter((r: any) => word.test(fr(r.description))).reduce((s: number, r: any) => s + (r.value ?? 0), 0);
		const spellsFr = (b.breedSpellsId ?? []).slice(0, 3).map((id: number) => fr(spellMap.get(id)?.name)).filter(Boolean);
		const role = fr(b.gameplayDescription) || null;
		drafts.push({
			key: `class:${b.id}`,
			source_id: b.id,
			category: 'class',
			subtype: 'Classe',
			name,
			imageUrl: `${API}/img/breeds/symbol_${b.id}.png`,
			image: `breeds/symbol_${b.id}.png`,
			level: 200,
			info1: role,
			info2: spellsFr[0] ? `Sort : ${spellsFr[0]}` : null,
			facts: { role, spells: spellsFr, complexity: b.complexity },
			rawAtk: 1 + roleOf(/d[ée]g[âa]ts|dommage/i) * 10 + (b.breedRoles?.length ?? 0),
			rawDef: 1 + roleOf(/protect|tank|soin|r[ée]sist/i) * 10 + (b.complexity ?? 0),
			prestige: CLASS_PRESTIGE
		});
	}

	/* --- Rareté (percentile global du prestige) puis stats --- */
	const prestigeP = percentileRanks(drafts.map((d) => d.prestige));
	drafts.forEach((d, i) => (d.rarity = rarityFromPercentile(prestigeP[i])));
	for (const cat of ['monster', 'item', 'mount', 'class'] as const) {
		const group = drafts.filter((d) => d.category === cat);
		const a = percentileRanks(group.map((d) => Math.log1p(d.rawAtk)));
		const df = percentileRanks(group.map((d) => Math.log1p(d.rawDef)));
		group.forEach((d, i) => {
			d.attack = finalStat(a[i], d.rarity!);
			d.defense = finalStat(df[i], d.rarity!);
		});
	}

	console.log('3/4 Écriture en base');
	mkdirSync(dirname(join(DATA_DIR, 'game.db')), { recursive: true });
	const db = new Database(join(DATA_DIR, 'game.db'));
	migrate(db);
	const now = Date.now();
	const upsert = db.prepare(`
		INSERT INTO cards (key, source_id, category, subtype, name, image, level, rarity, attack, defense, info1, info2, facts, prestige, active, updated_at)
		VALUES (@key, @source_id, @category, @subtype, @name, @image, @level, @rarity, @attack, @defense, @info1, @info2, @facts, @prestige, 1, @now)
		ON CONFLICT(key) DO UPDATE SET source_id=excluded.source_id, category=excluded.category, subtype=excluded.subtype,
			name=excluded.name, image=excluded.image, level=excluded.level, rarity=excluded.rarity, attack=excluded.attack,
			defense=excluded.defense, info1=excluded.info1, info2=excluded.info2, facts=excluded.facts,
			prestige=excluded.prestige, active=1, updated_at=excluded.updated_at`);
	db.transaction(() => {
		for (const d of drafts)
			upsert.run({ ...d, facts: JSON.stringify(d.facts), now });
		// Les cartes absentes du nouvel import sont désactivées (jamais supprimées)
		db.prepare('UPDATE cards SET active = 0 WHERE updated_at <> ?').run(now);
	})();

	const counts = db
		.prepare('SELECT category, rarity, COUNT(*) n FROM cards WHERE active = 1 GROUP BY category, rarity')
		.all() as { category: string; rarity: number; n: number }[];
	const table: Record<string, Record<string, number>> = {};
	for (const c of counts) {
		table[c.category] ??= {};
		table[c.category][RARITIES[c.rarity].code] = c.n;
	}
	console.table(table);
	console.log(`  total : ${drafts.length} cartes`);

	if (SKIP_IMAGES) return db.close();
	console.log('4/4 Images (cache local)');
	const toFetch = [...new Map(drafts.filter((d) => d.image && d.imageUrl).map((d) => [d.image!, d.imageUrl!])).entries()].filter(
		([rel]) => !existsSync(join(IMG_DIR, rel))
	);
	let done = 0;
	const missing: string[] = [];
	const CONC = 6;
	for (let i = 0; i < toFetch.length; i += CONC) {
		await Promise.all(
			toFetch.slice(i, i + CONC).map(async ([rel, url]) => {
				try {
					const res = await fetch(url, { headers: { 'user-agent': UA } });
					if (!res.ok) throw new Error(String(res.status));
					const buf = Buffer.from(await res.arrayBuffer());
					mkdirSync(dirname(join(IMG_DIR, rel)), { recursive: true });
					writeFileSync(join(IMG_DIR, rel), buf);
				} catch {
					missing.push(rel);
				}
				done++;
			})
		);
		if (done % 300 < CONC) console.log(`  ${done}/${toFetch.length}`);
	}
	if (missing.length) {
		console.log(`  ${missing.length} images introuvables, cartes affichées avec une icône de repli`);
		const setNull = db.prepare('UPDATE cards SET image = NULL WHERE image = ?');
		db.transaction(() => missing.forEach((m) => setNull.run(m)))();
	}
	db.close();
	console.log('Import terminé.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
