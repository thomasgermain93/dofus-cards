/**
 * Reflet holographique : met à jour --mx / --my (en %) sur :root selon la souris
 * ou l'inclinaison du téléphone. Une seule écoute pour toutes les cartes (léger).
 */
let started = false;
let orientationOn = false;

function set(el: HTMLElement, x: number, y: number) {
	el.style.setProperty('--mx', `${Math.round(x * 100)}%`);
	el.style.setProperty('--my', `${Math.round(y * 100)}%`);
}

export function initHolo() {
	if (started || typeof window === 'undefined') return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	started = true;
	const root = document.documentElement;
	let raf = 0;
	window.addEventListener(
		'pointermove',
		(e) => {
			if (orientationOn || e.pointerType === 'touch') return;
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => set(root, e.clientX / innerWidth, e.clientY / innerHeight));
		},
		{ passive: true }
	);
	// Android et iOS déjà autorisé : l'inclinaison fonctionne sans demande
	const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
	if (D && typeof D.requestPermission !== 'function') listenOrientation();
}

let orientationListening = false;
function listenOrientation() {
	if (orientationListening) return;
	orientationListening = true;
	const root = document.documentElement;
	let raf = 0;
	window.addEventListener(
		'deviceorientation',
		(e) => {
			if (e.gamma == null || e.beta == null) return;
			orientationOn = true;
			const x = Math.min(1, Math.max(0, (e.gamma + 30) / 60));
			const y = Math.min(1, Math.max(0, (e.beta - 20) / 60));
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				set(root, x, y);
				root.style.setProperty('--tilt-x', `${((x - 0.5) * 16).toFixed(1)}deg`);
				root.style.setProperty('--tilt-y', `${((0.5 - y) * 16).toFixed(1)}deg`);
			});
		},
		{ passive: true }
	);
}

/** iOS : l'accès à l'inclinaison doit être demandé lors d'un geste (ex. ouvrir un paquet). */
export async function requestTilt() {
	const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
	if (!D) return;
	try {
		if (typeof D.requestPermission === 'function') {
			if ((await D.requestPermission()) === 'granted') listenOrientation();
		} else listenOrientation();
	} catch {
		/* refus ou contexte non sécurisé : on garde la souris */
	}
}

/** Action Svelte : inclinaison 3D d'une grande carte au survol (souris) ou selon le téléphone. */
export function tilt(node: HTMLElement) {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
	node.classList.add('tilting');
	let raf = 0;
	const move = (e: PointerEvent) => {
		const r = node.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width;
		const y = (e.clientY - r.top) / r.height;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			set(node, x, y);
			node.style.setProperty('--tilt-x', `${((x - 0.5) * 18).toFixed(1)}deg`);
			node.style.setProperty('--tilt-y', `${((0.5 - y) * 18).toFixed(1)}deg`);
		});
	};
	const leave = () => {
		cancelAnimationFrame(raf);
		for (const p of ['--mx', '--my', '--tilt-x', '--tilt-y']) node.style.removeProperty(p);
	};
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerleave', leave);
	return {
		destroy() {
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerleave', leave);
		}
	};
}
