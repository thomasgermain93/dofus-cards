/** Petits messages animés en haut de l'écran (succès, gains, quêtes). */
export interface Toast {
	id: number;
	text: string;
	kind: 'success' | 'reward' | 'info' | 'error';
	icon?: string;
}
let seq = 0;
export const toasts = $state<{ list: Toast[] }>({ list: [] });

export function toast(text: string, kind: Toast['kind'] = 'info', icon?: string, ms = 3200) {
	const id = ++seq;
	toasts.list = [...toasts.list.slice(-2), { id, text, kind, icon }];
	setTimeout(() => (toasts.list = toasts.list.filter((t) => t.id !== id)), ms);
}
