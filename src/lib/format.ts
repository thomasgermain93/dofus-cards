const nf = new Intl.NumberFormat('fr-FR');
export const fmt = (n: number | null | undefined) => nf.format(n ?? 0);

/** « 2 h 05 », « 4 min 12 s », « 35 s » */
export function duration(ms: number) {
	if (ms <= 0) return '0 s';
	const s = Math.floor(ms / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (d > 0) return `${d} j ${h} h`;
	if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
	if (m > 0) return `${m} min ${String(sec).padStart(2, '0')} s`;
	return `${sec} s`;
}

export function ago(ts: number, now = Date.now()) {
	const s = Math.max(0, Math.floor((now - ts) / 1000));
	if (s < 60) return 'à l’instant';
	if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
	if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
	return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export const imgUrl = (path: string | null) => (path ? `/img/${path}` : null);
