export interface CardView {
	id: number;
	name: string;
	image: string | null;
	category: string;
	subtype: string;
	level: number;
	rarity: number;
	attack: number;
	defense: number;
	info1: string | null;
	info2: string | null;
	flavor?: string | null;
}
