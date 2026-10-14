/** Même formule que côté serveur (constants.ts). */
export const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
