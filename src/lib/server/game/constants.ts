/** Réglages d'équilibrage du jeu (tous les nombres magiques sont ici). */
export const PACK_INTERVAL_MS = 10 * 60 * 1000; // 1 paquet toutes les 10 minutes
export const PACK_MAX = 10; // réserve maximale
export const PACK_SIZE = 5;
export const STARTING_PACKS = 3;
export const STARTING_KAMAS = 100;

/** Probabilité de chaque rareté pour une carte de paquet (somme = 1). */
export const PACK_ODDS = [0.5, 0.27, 0.13, 0.065, 0.028, 0.007];

/**
 * Vente rapide au jeu : kamas reçus par exemplaire, selon la rareté.
 * Volontairement bas (environ 45 kamas par paquet en moyenne) pour que les
 * enchères entre joueurs restent plus intéressantes pour les cartes recherchées.
 */
export const SELL_VALUES = [1, 3, 10, 30, 100, 400];

/** Points de collection par rareté (classement). */
export const COLLECTION_POINTS = [1, 2, 5, 15, 40, 100];
export const DUEL_WIN_POINTS = 50;

export const XP = { pack: 5, newCard: 2, duelWin: 30, duelLoss: 10, duelDraw: 15, trade: 10, auctionSold: 10 };

/* ---------------- Rétention (boucle 2) ---------------- */

export type BoosterKind = 'bronze' | 'silver' | 'gold' | 'welcome';

/** Boosters bonus (jamais achetables) : rareté minimale de la 5e carte et multiplicateur des chances Rare+. */
export const BOOSTERS: Record<BoosterKind, { name: string; minLast: number; boost: number; shiny: boolean }> = {
	bronze: { name: 'Booster Bronze', minLast: 2, boost: 1, shiny: false },
	silver: { name: 'Booster Argent', minLast: 3, boost: 1.6, shiny: false },
	gold: { name: 'Booster Or', minLast: 4, boost: 2.2, shiny: true },
	welcome: { name: 'Booster de bienvenue', minLast: 2, boost: 1.5, shiny: false }
};

/** Événement temporaire (idée Ankama « extension ») : raretés boostées et cartes mises en avant. */
export const EVENT = {
	key: 'semaine-dofus-2026',
	name: 'Semaine des Dofus',
	description: 'Toute la semaine, chaque paquet a 1 chance sur 6 de remplacer sa dernière carte par un Dofus ou une Prysmaradite.',
	start: Date.UTC(2026, 9, 8, 22), // 9 octobre 00:00 à Bruxelles
	end: Date.UTC(2026, 9, 18, 22), // 19 octobre 00:00 à Bruxelles
	chance: 1 / 6,
	subtypes: ['Dofus', 'Prysmaradite']
};
export const eventActive = (now = Date.now()) => now >= EVENT.start && now < EVENT.end;

/** Récompenses des premières minutes. */
export const ONBOARDING_REWARD = { kamas: 200, fragments: 60 };
export const HUNT_REWARD = { kamas: 30, fragments: 25 };

/** Calendrier de la série de connexion (7 jours, puis on recommence). +1 paquet gratuit chaque jour. */
export const DAILY_CALENDAR: { kamas: number; fragments?: number; booster?: BoosterKind }[] = [
	{ kamas: 40 },
	{ kamas: 50, fragments: 20 },
	{ kamas: 60, booster: 'bronze' },
	{ kamas: 80, fragments: 40 },
	{ kamas: 100, booster: 'silver' },
	{ kamas: 120, fragments: 60 },
	{ kamas: 150, fragments: 100, booster: 'gold' }
];
export const DAILY_BONUS_PACK = 1;

/** Cartes brillantes : chance par carte tirée, et multiplicateur de valeur à la vente / au recyclage. */
export const SHINY_CHANCE = 1 / 40;
export const SHINY_VALUE_MULT = 5;

/** Fabrication : fragments obtenus en recyclant 1 exemplaire, et coût pour fabriquer une carte, par rareté. */
export const RECYCLE_VALUES = [5, 15, 50, 150, 500, 2000];
export const CRAFT_COSTS = [30, 80, 250, 800, 2400, 8000];

/** Coffre de la semaine : selon le nombre de quêtes récupérées dans la semaine (heure de Bruxelles). */
export const CHEST_TIERS: { tier: 'gold' | 'silver' | 'bronze'; name: string; min: number; kamas: number; fragments: number; booster: BoosterKind }[] = [
	{ tier: 'gold', name: 'Coffre en or', min: 16, kamas: 500, fragments: 300, booster: 'gold' },
	{ tier: 'silver', name: 'Coffre en argent', min: 10, kamas: 250, fragments: 120, booster: 'silver' },
	{ tier: 'bronze', name: 'Coffre en bronze', min: 4, kamas: 100, fragments: 40, booster: 'bronze' }
];

export const AUCTION_DURATIONS_H = [1, 6, 24, 72];
export const AUCTION_MIN_INCREMENT = 0.05; // +5 % (au moins 1 kama)
export const AUCTION_MAX_OPEN = 10; // enchères ouvertes simultanées par joueur

export const DUEL_DECK_SIZE = 3;
export const DUEL_QUESTIONS_PER_CARD = 3;
export const DUEL_BOT_ACCURACY = 0.55;
export const DUEL_MAX_PER_DAY = 20;

export function levelFromXp(xp: number) {
	return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}
export function xpForLevel(level: number) {
	return (level - 1) ** 2 * 50;
}
