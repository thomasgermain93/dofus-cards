export type Rng = () => number;

/** RNG serveur par défaut (crypto). Les tests injectent un RNG déterministe. */
export const cryptoRng: Rng = () => {
	const a = new Uint32Array(1);
	crypto.getRandomValues(a);
	return a[0] / 2 ** 32;
};

/** RNG déterministe (mulberry32) pour les tests. */
export function seededRng(seed: number): Rng {
	let t = seed >>> 0;
	return () => {
		t = (t + 0x6d2b79f5) >>> 0;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

export function pick<T>(arr: T[], rng: Rng): T {
	return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
