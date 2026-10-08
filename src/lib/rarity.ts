export const RARITY = [
	{ code: 'C', name: 'Commune', var: '--r-common' },
	{ code: 'PC', name: 'Peu commune', var: '--r-uncommon' },
	{ code: 'R', name: 'Rare', var: '--r-rare' },
	{ code: 'SR', name: 'Super rare', var: '--r-superrare' },
	{ code: 'UR', name: 'Ultra rare', var: '--r-ultrarare' },
	{ code: 'L', name: 'Légendaire', var: '--r-legendary' }
] as const;

export const rarityColor = (r: number) => `var(${RARITY[r]?.var ?? '--r-common'})`;

export const CATEGORIES = [
	{ key: 'monster', name: 'Monstres', one: 'Monstre' },
	{ key: 'item', name: 'Objets', one: 'Objet' },
	{ key: 'mount', name: 'Montures', one: 'Monture' },
	{ key: 'class', name: 'Classes', one: 'Classe' }
] as const;
