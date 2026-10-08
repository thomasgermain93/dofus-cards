/**
 * Formules de rareté et de statistiques des cartes.
 * Module pur (aucune dépendance) : utilisé par le script d'import et les tests.
 * Documentation détaillée dans le README (section « Formules »).
 */

export const RARITIES = [
	{ code: 'C', name: 'Commune', color: 'common' },
	{ code: 'PC', name: 'Peu commune', color: 'uncommon' },
	{ code: 'R', name: 'Rare', color: 'rare' },
	{ code: 'SR', name: 'Super rare', color: 'superrare' },
	{ code: 'UR', name: 'Ultra rare', color: 'ultrarare' },
	{ code: 'L', name: 'Légendaire', color: 'legendary' }
] as const;

/**
 * Seuils (percentile du prestige, sur l'ensemble des cartes) à partir desquels
 * on passe à la rareté suivante. Donne une pyramide : 45 % C, 27 % PC, 15 % R,
 * 8 % SR, 3,8 % UR, 1,2 % L.
 */
export const RARITY_THRESHOLDS = [0.45, 0.72, 0.87, 0.95, 0.988];

export function rarityFromPercentile(p: number): number {
	let r = 0;
	for (const t of RARITY_THRESHOLDS) if (p >= t) r++;
	return r;
}

/**
 * Rang percentile (0..1) de chaque valeur dans la liste. Les ex aequo reçoivent
 * le même rang (rang moyen), ce qui rend le résultat stable.
 */
export function percentileRanks(values: number[]): number[] {
	const n = values.length;
	if (n === 0) return [];
	if (n === 1) return [1];
	const idx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
	const out = new Array<number>(n);
	let i = 0;
	while (i < n) {
		let j = i;
		while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
		const rank = (i + j) / 2 / (n - 1);
		for (let k = i; k <= j; k++) out[idx[k][1]] = rank;
		i = j + 1;
	}
	return out;
}

/**
 * Statistique finale sur 10 000 : 60 % vient du percentile de la valeur brute
 * dans sa catégorie (monstres, objets...), 30 % de la rareté, plus 1 000 de base.
 * Arrondi à la dizaine (comme les cartes de WikiMasters).
 */
export function finalStat(percentile: number, rarity: number): number {
	const v = 1000 + 6000 * percentile + 3000 * (rarity / 5);
	return Math.round(Math.max(0, Math.min(10000, v)) / 10) * 10;
}

/* ------------------------------------------------------------------ */
/* Monstres                                                            */
/* ------------------------------------------------------------------ */

export interface MonsterGrade {
	level: number;
	lifePoints: number;
	actionPoints: number;
	strength: number;
	intelligence: number;
	chance: number;
	agility: number;
	damageBonus?: number;
	reductionEarth: number;
	reductionWater: number;
	reductionFire: number;
	reductionAir: number;
	reductionNeutral: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Attaque brute : niveau x (1 + meilleure caractéristique élémentaire / 100) x (PA / 6). */
export function monsterRawAttack(g: MonsterGrade): number {
	const elem = Math.max(g.strength, g.intelligence, g.chance, g.agility, 0);
	const ap = g.actionPoints > 0 ? g.actionPoints : 6;
	return Math.max(1, g.level) * (1 + elem / 100) * (ap / 6) + (g.damageBonus ?? 0) * 2;
}

/** Défense brute : PV x (1 + résistance moyenne / 100), résistance bornée entre -50 et 80 %. */
export function monsterRawDefense(g: MonsterGrade): number {
	const res =
		(g.reductionEarth + g.reductionWater + g.reductionFire + g.reductionAir + g.reductionNeutral) /
		5;
	return Math.max(1, g.lifePoints) * (1 + clamp(res, -50, 80) / 100);
}

export interface MonsterPrestigeInput {
	level: number;
	isBoss: boolean;
	isArchi: boolean;
	inDungeon: boolean;
	hpPercentile: number;
}

/** Prestige (sert à la rareté) : niveau + bonus boss / archimonstre / donjon. */
export function monsterPrestige(m: MonsterPrestigeInput): number {
	return (
		Math.min(m.level, 240) / 200 +
		(m.isBoss ? 0.7 : 0) +
		(m.isArchi ? 0.45 : 0) +
		(m.inDungeon && !m.isBoss ? 0.1 : 0) +
		m.hpPercentile * 0.2
	);
}

/* ------------------------------------------------------------------ */
/* Objets et montures                                                   */
/* ------------------------------------------------------------------ */

/** Poids des caractéristiques (ids DofusDB) pour l'attaque. */
export const ATTACK_WEIGHTS: Record<number, number> = {
	10: 1, 13: 1, 14: 1, 15: 1, // Force, Chance, Agilité, Intelligence
	25: 1, // Puissance
	16: 5, // Dommages
	88: 5, 89: 5, 90: 5, 91: 5, 92: 5, // Dommages élémentaires
	86: 5, // Dommages critiques
	84: 2, // Dommages de poussée
	18: 6, // % Critique
	1: 100, // PA
	23: 70, // PM
	19: 50, // Portée
	26: 30, // Invocations
	82: 7, 83: 7, // Retrait PA / PM
	49: 3, // Soins
	31: 2, 123: 6, 122: 6, 125: 6, 120: 6 // Maîtrise d'arme, % dommages sorts/armes/mêlée/distance
};

/** Poids des caractéristiques pour la défense. */
export const DEFENSE_WEIGHTS: Record<number, number> = {
	11: 0.25, // Vitalité
	0: 0.25, // PV
	33: 6, 34: 6, 35: 6, 36: 6, 37: 6, // Résistances %
	54: 2, 55: 2, 56: 2, 57: 2, 58: 2, // Résistances fixes
	12: 0.5, // Sagesse
	27: 7, 28: 7, // Esquive PA / PM
	78: 4, 79: 4, // Fuite, Tacle
	85: 2, 87: 2, // Résistance poussée / critiques
	44: 0.1, // Initiative
	124: 6, 121: 6, 141: 6, 142: 6 // % dommages subis réduits
};

export interface ItemEffect {
	characteristic: number;
	from: number;
	to: number;
	category?: number;
	/** -1 si l'effet est un malus (ex. « -Force »), 1 sinon */
	bonusType?: number;
}

/** Attaque et défense brutes d'un objet : somme pondérée de ses effets + base liée au niveau. */
export function itemRawStats(level: number, effects: ItemEffect[]): { atk: number; def: number } {
	let atk = level * 0.5;
	let def = level * 0.5;
	for (const e of effects) {
		const value = Math.max(Math.abs(e.from), Math.abs(e.to));
		const sign = e.bonusType === -1 ? -1 : 1;
		if (e.category === 2) {
			// Effet de dégâts d'arme : moyenne du jet
			const avg = e.to > 0 ? (e.from + e.to) / 2 : e.from;
			atk += avg * 3;
			continue;
		}
		if (ATTACK_WEIGHTS[e.characteristic]) atk += sign * value * ATTACK_WEIGHTS[e.characteristic];
		if (DEFENSE_WEIGHTS[e.characteristic]) def += sign * value * DEFENSE_WEIGHTS[e.characteristic];
	}
	return { atk: Math.max(1, atk), def: Math.max(1, def) };
}

export interface ItemPrestigeInput {
	level: number;
	isDofus: boolean;
	isPrysmaradite: boolean;
	isLegendary: boolean;
	inSet: boolean;
	isPet: boolean;
	powerPercentile: number;
}

export function itemPrestige(i: ItemPrestigeInput): number {
	return (
		Math.min(i.level, 200) / 200 +
		(i.isDofus ? 1.2 : 0) +
		(i.isPrysmaradite ? 0.9 : 0) +
		(i.isLegendary ? 0.5 : 0) +
		(i.inSet ? 0.1 : 0) +
		(i.inSet && i.level >= 180 ? 0.25 : 0) +
		(i.isPet ? 0.15 : 0) +
		i.powerPercentile * 0.15
	);
}

export interface MountPrestigeInput {
	level: number;
	family: string;
	isBicolor: boolean;
	isMontilier: boolean;
}

export function mountPrestige(m: MountPrestigeInput): number {
	return (
		0.35 +
		(Math.min(m.level, 200) / 200) * 0.5 +
		(m.family === 'Dragodinde' ? 0 : 0.1) +
		(m.isBicolor ? 0.1 : 0) +
		(m.isMontilier ? 0.25 : 0)
	);
}

/** Les 19 classes sont des cartes de prestige (bande Ultra rare). */
export const CLASS_PRESTIGE = 1.9;
