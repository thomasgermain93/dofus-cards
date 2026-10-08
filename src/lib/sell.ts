import { invalidateAll } from '$app/navigation';

/** Barème de la vente rapide (doit rester aligné sur SELL_VALUES côté serveur). */
export const SELL_VALUES = [1, 3, 10, 30, 100, 400];

export interface SellResult {
	gain: number;
	cards: number;
	kamas: number;
	error?: string;
}

/** Appelle l'API de vente avec un identifiant unique (anti double clic) puis rafraîchit les données. */
export async function sell(payload: { items: { cardId: number; count: number }[] } | { duplicates: true; maxRarity: number }): Promise<SellResult> {
	const res = await fetch('/api/sell', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ...payload, nonce: crypto.randomUUID() })
	});
	const data = (await res.json().catch(() => ({ error: 'Erreur réseau.' }))) as SellResult;
	if (res.ok) await invalidateAll();
	return res.ok ? data : { gain: 0, cards: 0, kamas: 0, error: data.error ?? 'Erreur.' };
}
