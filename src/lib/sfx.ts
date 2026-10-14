/** Petits sons du jeu (Kenney, CC0), avec coupure du son mémorisée. */
const NAMES = ['tear', 'flip', 'place', 'rare', 'epic', 'legendary'] as const;
export type Sfx = (typeof NAMES)[number];

const cache = new Map<Sfx, HTMLAudioElement>();
let muted = false;
try {
	muted = typeof localStorage !== 'undefined' && localStorage.getItem('dc-muted') === '1';
} catch {
	/* stockage indisponible */
}

export const isMuted = () => muted;
export function setMuted(v: boolean) {
	muted = v;
	try {
		localStorage.setItem('dc-muted', v ? '1' : '0');
	} catch {
		/* ignore */
	}
}

export function preloadSfx() {
	if (typeof Audio === 'undefined') return;
	for (const n of NAMES) {
		if (cache.has(n)) continue;
		const a = new Audio(`/sfx/${n}.mp3`);
		a.preload = 'auto';
		cache.set(n, a);
	}
}

export function play(name: Sfx, volume = 0.5) {
	if (muted || typeof Audio === 'undefined') return;
	const base = cache.get(name) ?? new Audio(`/sfx/${name}.mp3`);
	const a = base.cloneNode() as HTMLAudioElement;
	a.volume = volume;
	a.play().catch(() => {});
}

export function vibrate(pattern: number | number[]) {
	if (muted) return;
	try {
		navigator.vibrate?.(pattern);
	} catch {
		/* non supporté (iOS) */
	}
}
