import { invalidateAll } from '$app/navigation';

/** Barème de la vente rapide (doit rester aligné sur SELL_VALUES côté serveur). */
export const SELL_VALUES = [1, 3, 10, 30, 100, 400];
export const RECYCLE_VALUES = [5, 15, 50, 150, 500, 2000];
export const CRAFT_COSTS = [30, 80, 250, 800, 2400, 8000];
export const SHINY_MULT = 5;

export interface SellResult {
	gain: number;
	cards: number;
	kamas: number;
	fragments?: number;
	error?: string;
}

/** Appelle l'API de vente avec un identifiant unique (anti double clic) puis rafraîchit les données. */
export async function sell(
	payload: ({ items: { cardId: number; count: number }[] } | { duplicates: true; maxRarity: number }) & { mode?: 'sell' | 'recycle' }
): Promise<SellResult> {
	const res = await fetch('/api/sell', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ...payload, nonce: crypto.randomUUID() })
	});
	const data = (await res.json().catch(() => ({ error: 'Erreur réseau.' }))) as SellResult;
	if (res.ok) await invalidateAll();
	return res.ok ? data : { gain: 0, cards: 0, kamas: 0, error: data.error ?? 'Erreur.' };
}
