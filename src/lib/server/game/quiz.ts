import type { DB } from '../db';
import type { CardRow } from './core';
import { shuffle, type Rng } from './rng';

/**
 * Génération automatique des questions de quiz à partir des données des cartes
 * (aucun LLM). Règles (boucle 4, vérifiées par des tests sur 1 000 questions) :
 * 1. la bonne réponse n'est jamais visible sur la carte montrée : jamais le nom de la carte,
 *    jamais une réponse qui partage un mot significatif avec ce nom (ex. « Amulette Volcanique »
 *    et « Panoplie Volcanique »), et le niveau est masqué sur la carte pendant le quiz ;
 * 2. quatre choix distincts, jamais quasi identiques (même texte normalisé, inclus l'un dans
 *    l'autre, ou à 2 lettres près) ;
 * 3. une seule question par fait et par carte (pas deux questions de niveau) ;
 * 4. des niveaux plausibles : écart d'au moins 5 niveaux, plafond 200 pour les objets et montures.
 */

export interface Question {
	prompt: string;
	choices: string[];
	correct: number;
}

interface Facts {
	level?: number;
	zone?: string | null;
	race?: string | null;
	dungeon?: string | null;
	bossOf?: string | null;
	archiOf?: string | null;
	type?: string | null;
	set?: string | null;
	dropMonster?: string | null;
	family?: string | null;
	role?: string | null;
	spells?: string[];
}

interface Entry {
	id: number;
	name: string;
	category: string;
	level: number;
	attack: number;
	defense: number;
	facts: Facts;
}

interface Pools {
	entries: Entry[];
	values: Record<string, string[]>;
}

const cache = new WeakMap<object, Pools>();

function pools(db: DB): Pools {
	const hit = cache.get(db);
	if (hit) return hit;
	const rows = db.prepare('SELECT id, name, category, level, attack, defense, facts FROM cards WHERE active = 1').all() as {
		id: number;
		name: string;
		category: string;
		level: number;
		attack: number;
		defense: number;
		facts: string;
	}[];
	const entries: Entry[] = rows.map((r) => ({ id: r.id, name: r.name, category: r.category, level: r.level, attack: r.attack, defense: r.defense, facts: JSON.parse(r.facts || '{}') }));
	const collect = (fn: (e: Entry) => (string | null | undefined)[]) => [...new Set(entries.flatMap(fn).filter((v): v is string => !!v))];
	const values = {
		zone: collect((e) => [e.facts.zone]),
		race: collect((e) => [e.facts.race]),
		dungeon: collect((e) => [e.facts.dungeon, e.facts.bossOf]),
		set: collect((e) => [e.facts.set]),
		type: collect((e) => (e.category === 'item' ? [e.facts.type] : [])),
		family: collect((e) => [e.facts.family]),
		role: collect((e) => [e.facts.role]),
		spell: collect((e) => e.facts.spells ?? []),
		monster: collect((e) => (e.category === 'monster' ? [e.name] : []))
	};
	const p = { entries, values };
	cache.set(db, p);
	return p;
}

/** Vide le cache (après un import). */
export function resetQuizCache(db: DB) {
	cache.delete(db);
}

/* ------------------------------------------------------------------ */
/* Règles de qualité                                                    */
/* ------------------------------------------------------------------ */

export const normText = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const STOP = new Set(['panoplie', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'a', 'au', 'aux', 'un', 'une', 'donjon', 'zone', 'foret', 'plaine']);

/** Mots significatifs (4 lettres et plus, hors mots outils). */
export const keyWords = (s: string) =>
	normText(s)
		.split(' ')
		.filter((w) => w.length >= 4 && !STOP.has(w))
		.map((w) => w.replace(/(s|x)$/, '').replace(/e$/, '')); // pluriel et féminin simples : Volcaniques = Volcanique

function levenshtein(a: string, b: string) {
	if (Math.abs(a.length - b.length) > 2) return 3;
	const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = dp[0];
		dp[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = dp[j];
			dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = tmp;
		}
	}
	return dp[b.length];
}

/** Deux choix trop proches pour être distingués honnêtement. */
export function tooSimilar(a: string, b: string) {
	const x = normText(a);
	const y = normText(b);
	if (x === y) return true;
	if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return true;
	return levenshtein(x, y) <= 2;
}

/** La réponse se lit-elle sur la carte (son nom) ? */
export function givesAway(answer: string, cardName: string) {
	if (normText(answer) === normText(cardName)) return true;
	const nameWords = new Set(keyWords(cardName));
	return keyWords(answer).some((w) => nameWords.has(w));
}

function build(prompt: string, answer: string, pool: string[], rng: Rng, cardName: string): Question | null {
	if (givesAway(answer, cardName)) return null;
	const decoys: string[] = [];
	for (const v of shuffle(pool, rng)) {
		if (decoys.length === 3) break;
		if (tooSimilar(v, answer) || decoys.some((d) => tooSimilar(d, v)) || normText(v) === normText(cardName)) continue;
		decoys.push(v);
	}
	if (decoys.length < 3) return null;
	const choices = shuffle([answer, ...decoys], rng);
	return { prompt, choices, correct: choices.indexOf(answer) };
}

/** Niveaux plausibles : écart d'au moins 5, plafond 200 pour les objets et montures. */
function levelQuestion(prompt: string, level: number, rng: Rng, max = Infinity): Question {
	const step = Math.max(5, Math.round(level * 0.12));
	const options = new Set<number>([level]);
	const offsets = shuffle([-3, -2, -1, 1, 2, 3], rng);
	for (const o of [...offsets, -4, -5, -6, 4, 5, 6]) {
		if (options.size >= 4) break;
		const v = level + o * step;
		if (v >= 1 && v <= max) options.add(v);
	}
	const choices = shuffle([...options].map(String), rng);
	return { prompt, choices, correct: choices.indexOf(String(level)) };
}

const LABEL: Record<string, [string, string]> = {
	monster: ['monstres', 'Lequel de ces monstres'],
	item: ['objets', 'Lequel de ces objets'],
	mount: ['montures', 'Laquelle de ces montures'],
	class: ['classes', 'Laquelle de ces classes']
};

const catCache = new WeakMap<Entry[], Map<string, Entry[]>>();
function byCategory(entries: Entry[], category: string) {
	let m = catCache.get(entries);
	if (!m) {
		m = new Map();
		for (const e of entries) m.set(e.category, [...(m.get(e.category) ?? []), e]);
		catCache.set(entries, m);
	}
	return m.get(category) ?? [];
}

type Metric = 'level-high' | 'level-low' | 'attack' | 'defense';
const METRIC: Record<Metric, { get: (e: Entry) => number; gap: number; text: string; high: boolean }> = {
	'level-high': { get: (e) => e.level, gap: 10, text: 'a le niveau le plus élevé', high: true },
	'level-low': { get: (e) => e.level, gap: 10, text: 'a le niveau le plus bas', high: false },
	attack: { get: (e) => e.attack, gap: 400, text: 'a la plus forte attaque', high: true },
	defense: { get: (e) => e.defense, gap: 400, text: 'a la plus forte défense', high: true }
};

/** Question de comparaison sur 4 AUTRES cartes de la même catégorie (aucune réponse visible). */
function comparisonQuestion(entries: Entry[], card: CardRow, rng: Rng, metric: Metric): Question | null {
	const label = LABEL[card.category];
	if (!label) return null;
	const m = METRIC[metric];
	const same = byCategory(entries, card.category);
	const picked: Entry[] = [];
	// Tirage aléatoire borné (pas de mélange complet du catalogue : rapide même avec 5 000 cartes)
	for (let tries = 0; picked.length < 4 && tries < 200 && same.length; tries++) {
		const e = same[Math.floor(rng() * same.length)];
		if (e.id === card.id || m.get(e) <= 0 || givesAway(e.name, card.name)) continue;
		if (picked.some((p) => p.id === e.id || Math.abs(m.get(p) - m.get(e)) < m.gap || tooSimilar(p.name, e.name))) continue;
		picked.push(e);
	}
	if (picked.length < 4) return null;
	const best = [...picked].sort((a, b) => (m.high ? m.get(b) - m.get(a) : m.get(a) - m.get(b)))[0];
	const choices = picked.map((p) => p.name);
	return { prompt: `${label[1]} ${m.text} ?`, choices, correct: choices.indexOf(best.name) };
}

/** Une autre carte qui partage un fait avec celle-ci (même zone, même panoplie, même famille). */
function sameAsQuestion(entries: Entry[], card: CardRow, key: 'zone' | 'set' | 'family', value: string, prompt: string, rng: Rng): Question | null {
	const same = byCategory(entries, card.category);
	const mates = same.filter((e) => e.id !== card.id && e.facts[key] === value && !givesAway(e.name, card.name));
	if (!mates.length) return null;
	const others: string[] = [];
	for (let t = 0; others.length < 40 && t < 400; t++) {
		const e = same[Math.floor(rng() * same.length)];
		if (e.facts[key] && e.facts[key] !== value) others.push(e.name);
	}
	const answer = mates[Math.floor(rng() * mates.length)].name;
	return build(prompt, answer, others, rng, card.name);
}

type Candidate = { key: string; q: Question | null };

/** Toutes les questions possibles pour une carte, chacune liée à un fait (un fait = une question). */
function candidates(db: DB, card: CardRow, rng: Rng): Candidate[] {
	const { entries, values } = pools(db);
	const f: Facts = JSON.parse(card.facts || '{}');
	const n = card.name;
	const out: Candidate[] = [];
	if (card.category === 'monster') {
		if (f.level) out.push({ key: 'level', q: levelQuestion(`À quel niveau est ${n} (grade le plus haut) ?`, f.level, rng) });
		if (f.zone) out.push({ key: 'zone', q: build(`Dans quelle zone trouve-t-on ${n} ?`, f.zone, values.zone, rng, n) });
		if (f.race) out.push({ key: 'race', q: build(`À quelle famille de monstres appartient ${n} ?`, f.race, values.race, rng, n) });
		if (f.bossOf) out.push({ key: 'dungeon', q: build(`Quel donjon ${n} garde-t-il ?`, f.bossOf, values.dungeon, rng, n) });
		else if (f.dungeon) out.push({ key: 'dungeon', q: build(`Dans quel donjon croise-t-on ${n} ?`, f.dungeon, values.dungeon, rng, n) });
		if (f.archiOf) out.push({ key: 'archi', q: build(`${n} est l'archimonstre de quel monstre ?`, f.archiOf, values.monster, rng, n) });
		if (f.zone) out.push({ key: 'mate', q: sameAsQuestion(entries, card, 'zone', f.zone, `Lequel de ces monstres vit dans la même zone que ${n} ?`, rng) });
	} else if (card.category === 'item') {
		if (f.level) out.push({ key: 'level', q: levelQuestion(`Quel est le niveau de l'objet ${n} ?`, f.level, rng, 200) });
		if (f.set) out.push({ key: 'set', q: build(`Quelle panoplie contient ${n} ?`, f.set, values.set, rng, n) });
		if (f.type) out.push({ key: 'type', q: build(`Quel type d'objet est ${n} ?`, f.type, values.type, rng, n) });
		if (f.dropMonster) out.push({ key: 'drop', q: build(`Quel monstre peut laisser tomber ${n} ?`, f.dropMonster, values.monster, rng, n) });
		if (f.set) out.push({ key: 'mate', q: sameAsQuestion(entries, card, 'set', f.set, `Lequel de ces objets fait partie de la même panoplie que ${n} ?`, rng) });
	} else if (card.category === 'mount') {
		if (f.family) out.push({ key: 'family', q: build(`À quelle famille de montures appartient ${n} ?`, f.family, values.family, rng, n) });
		if (f.level) out.push({ key: 'level', q: levelQuestion(`À partir de quel niveau peut-on chevaucher ${n} ?`, f.level, rng, 200) });
		if (f.family) out.push({ key: 'mate', q: sameAsQuestion(entries, card, 'family', f.family, `Laquelle de ces montures est de la même famille que ${n} ?`, rng) });
	} else if (card.category === 'class') {
		if (f.role) out.push({ key: 'role', q: build(`Quel est le rôle de la classe ${n} ?`, f.role, values.role, rng, n) });
		const SPELL_PROMPTS = [`Lequel de ces sorts appartient à la classe ${n} ?`, `Quel sort la classe ${n} peut-elle lancer ?`, `Lequel de ces sorts fait partie du grimoire de la classe ${n} ?`];
		(f.spells ?? []).forEach((s, i) =>
			out.push({ key: `spell${i}`, q: build(SPELL_PROMPTS[i % 3], s, values.spell.filter((v) => !(f.spells ?? []).includes(v)), rng, n) })
		);
	}
	for (const metric of ['level-high', 'level-low', 'attack', 'defense'] as Metric[]) out.push({ key: `cmp-${metric}`, q: comparisonQuestion(entries, card, rng, metric) });
	return out.filter((c) => !!c.q);
}

/** Tire `count` questions sur une carte : faits différents, prompts différents. */
export function questionsForCard(db: DB, card: CardRow, rng: Rng, count = 3): Question[] {
	const all = candidates(db, card, rng);
	// Les questions de comparaison ne servent qu'en complément
	const primary = shuffle(all.filter((c) => !c.key.startsWith('cmp')), rng);
	const extra = shuffle(all.filter((c) => c.key.startsWith('cmp')), rng);
	const out: Question[] = [];
	const used = new Set<string>();
	for (const c of [...primary, ...extra]) {
		if (out.length === count) break;
		if (used.has(c.key) || out.some((q) => q.prompt === c.q!.prompt)) continue;
		used.add(c.key);
		out.push(c.q!);
	}
	// Dernier recours (catalogue minuscule) : comparaisons supplémentaires sur d'autres cartes
	const metrics: Metric[] = ['level-high', 'level-low', 'attack', 'defense'];
	for (let tries = 0; out.length < count && tries < 12; tries++) {
		const q = comparisonQuestion(pools(db).entries, card, rng, metrics[tries % 4]);
		if (q && !out.some((o) => o.prompt === q.prompt && o.choices.join() === q.choices.join())) out.push(q);
	}
	while (out.length < count) out.push(levelQuestion(`Quel est le niveau de ${card.name} ?`, Math.max(1, card.level), rng, card.category === 'monster' ? Infinity : 200));
	return out;
}
