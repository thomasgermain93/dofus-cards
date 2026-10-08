/** Réglages d'équilibrage du jeu (tous les nombres magiques sont ici). */
export const PACK_INTERVAL_MS = 10 * 60 * 1000; // 1 paquet toutes les 10 minutes
export const PACK_MAX = 10; // réserve maximale
export const PACK_SIZE = 5;
export const STARTING_PACKS = 3;
export const STARTING_KAMAS = 100;

/** Probabilité de chaque rareté pour une carte de paquet (somme = 1). */
export const PACK_ODDS = [0.5, 0.27, 0.13, 0.065, 0.028, 0.007];

/** Kamas reçus en défaussant un doublon, par rareté. */
export const DISCARD_VALUES = [1, 3, 10, 30, 100, 400];

/** Points de collection par rareté (classement). */
export const COLLECTION_POINTS = [1, 2, 5, 15, 40, 100];
export const DUEL_WIN_POINTS = 50;

export const XP = { pack: 5, newCard: 2, duelWin: 30, duelLoss: 10, duelDraw: 15, trade: 10, auctionSold: 10 };

export const DAILY_BASE_KAMAS = 50;
export const DAILY_STREAK_BONUS = 10; // par jour consécutif, plafonné à 7 jours
export const DAILY_BONUS_PACK = 1;

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
