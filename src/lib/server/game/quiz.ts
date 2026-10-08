import type { DB } from '../db';
import type { CardRow } from './core';
import { shuffle, type Rng } from './rng';

/**
 * Génération automatique des questions de quiz à partir des données des cartes
 * (aucun LLM) : chaque gabarit utilise un fait de la carte comme bonne réponse
 * et pioche 3 leurres parmi les autres cartes.
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
	name: string;
	category: string;
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
	const rows = db.prepare('SELECT name, category, facts FROM cards WHERE active = 1').all() as {
		name: string;
		category: string;
		facts: string;
	}[];
	const entries: Entry[] = rows.map((r) => ({ name: r.name, category: r.category, facts: JSON.parse(r.facts || '{}') }));
	const collect = (fn: (e: Entry) => (string | null | undefined)[]) => [
		...new Set(entries.flatMap(fn).filter((v): v is string => !!v))
	];
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

function build(prompt: string, answer: string, pool: string[], rng: Rng): Question | null {
	const decoys = shuffle(
		pool.filter((v) => v !== answer),
		rng
	).slice(0, 3);
	if (decoys.length < 3) return null;
	const choices = shuffle([answer, ...decoys], rng);
	return { prompt, choices, correct: choices.indexOf(answer) };
}

function levelQuestion(prompt: string, level: number, rng: Rng): Question {
	const step = Math.max(2, Math.round(level * 0.12));
	const set = new Set<number>([level]);
	const offsets = shuffle([-3, -2, -1, 1, 2, 3], rng);
	for (const o of offsets) {
		if (set.size >= 4) break;
		const v = level + o * step;
		if (v >= 1) set.add(v);
	}
	let k = 4;
	while (set.size < 4) set.add(level + step * k++);
	const choices = shuffle([...set].map(String), rng);
	return { prompt, choices, correct: choices.indexOf(String(level)) };
}

function reverse(prompt: string, answer: string, others: string[], rng: Rng): Question | null {
	return build(prompt, answer, [...new Set(others)], rng);
}

/** Toutes les questions possibles pour une carte (avant tirage). */
function candidates(db: DB, card: CardRow, rng: Rng): Question[] {
	const { entries, values } = pools(db);
	const f: Facts = JSON.parse(card.facts || '{}');
	const n = card.name;
	const out: (Question | null)[] = [];
	if (card.category === 'monster') {
		if (f.level) out.push(levelQuestion(`À quel niveau est ${n} (grade le plus haut) ?`, f.level, rng));
		if (f.zone) out.push(build(`Dans quelle zone trouve-t-on ${n} ?`, f.zone, values.zone, rng));
		if (f.race) out.push(build(`À quelle famille de monstres appartient ${n} ?`, f.race, values.race, rng));
		if (f.bossOf) out.push(build(`Quel donjon ${n} garde-t-il ?`, f.bossOf, values.dungeon, rng));
		else if (f.dungeon) out.push(build(`Dans quel donjon croise-t-on ${n} ?`, f.dungeon, values.dungeon, rng));
		if (f.archiOf) out.push(build(`${n} est l'archimonstre de quel monstre ?`, f.archiOf, values.monster, rng));
		if (f.zone)
			out.push(
				reverse(
					`Lequel de ces monstres vit dans la zone ${f.zone} ?`,
					n,
					entries.filter((e) => e.category === 'monster' && e.facts.zone && e.facts.zone !== f.zone).map((e) => e.name),
					rng
				)
			);
	} else if (card.category === 'item') {
		if (f.level) out.push(levelQuestion(`Quel est le niveau de l'objet ${n} ?`, f.level, rng));
		if (f.set) out.push(build(`Quelle panoplie contient ${n} ?`, f.set, values.set, rng));
		if (f.type) out.push(build(`Quel type d'objet est ${n} ?`, f.type, values.type, rng));
		if (f.dropMonster) out.push(build(`Quel monstre peut laisser tomber ${n} ?`, f.dropMonster, values.monster, rng));
		if (f.set)
			out.push(
				reverse(
					`Lequel de ces objets fait partie de « ${f.set} » ?`,
					n,
					entries.filter((e) => e.category === 'item' && e.facts.set && e.facts.set !== f.set).map((e) => e.name),
					rng
				)
			);
	} else if (card.category === 'mount') {
		if (f.family) out.push(build(`À quelle famille de montures appartient ${n} ?`, f.family, values.family, rng));
		if (f.level) out.push(levelQuestion(`À partir de quel niveau peut-on utiliser ${n} ?`, f.level, rng));
		if (f.family)
			out.push(
				reverse(
					`Laquelle de ces montures est de la famille ${f.family} ?`,
					n,
					entries.filter((e) => e.category === 'mount' && e.facts.family !== f.family).map((e) => e.name),
					rng
				)
			);
	} else if (card.category === 'class') {
		if (f.role) out.push(build(`Quel est le rôle de la classe ${n} ?`, f.role, values.role, rng));
		for (const s of f.spells ?? [])
			out.push(build(`Lequel de ces sorts appartient à la classe ${n} ?`, s, values.spell.filter((v) => !(f.spells ?? []).includes(v) || v === s), rng));
		if (f.role)
			out.push(
				reverse(
					`Quelle classe a pour rôle « ${f.role} » ?`,
					n,
					entries.filter((e) => e.category === 'class' && e.facts.role !== f.role).map((e) => e.name),
					rng
				)
			);
	}
	return out.filter((q): q is Question => !!q);
}

/** Tire `count` questions différentes sur une carte. */
export function questionsForCard(db: DB, card: CardRow, rng: Rng, count = 3): Question[] {
	const all = shuffle(candidates(db, card, rng), rng);
	const seen = new Set<string>();
	const out: Question[] = [];
	for (const q of all) {
		if (seen.has(q.prompt)) continue;
		seen.add(q.prompt);
		out.push(q);
		if (out.length === count) break;
	}
	// Carte pauvre en données : on complète avec des questions de niveau.
	while (out.length < count) {
		out.push(levelQuestion(`Quel est le niveau de ${card.name} ?`, Math.max(1, card.level), rng));
	}
	return out;
}
