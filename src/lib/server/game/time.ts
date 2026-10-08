/** Dates « heure de Bruxelles » : les quêtes et la récompense du jour changent à minuit à Bruxelles. */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', hourCycle: 'h23' });

/** AAAA-MM-JJ à Bruxelles */
export const brusselsDay = (now: number) => dayFmt.format(new Date(now));

const keyToUtcNoon = (key: string) => Date.parse(`${key}T12:00:00Z`);
const utcNoonToKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Nombre de jours entre deux clés AAAA-MM-JJ (b - a). */
export const dayDiff = (a: string, b: string) => Math.round((keyToUtcNoon(b) - keyToUtcNoon(a)) / 86_400_000);

export const addDays = (key: string, n: number) => utcNoonToKey(keyToUtcNoon(key) + n * 86_400_000);

/** Lundi (AAAA-MM-JJ) de la semaine en cours à Bruxelles. */
export function brusselsWeek(now: number) {
	const key = brusselsDay(now);
	const dow = (new Date(keyToUtcNoon(key)).getUTCDay() + 6) % 7;
	return addDays(key, -dow);
}

/** Instant (ms) du prochain minuit à Bruxelles. */
export function nextBrusselsMidnight(now: number) {
	const tomorrow = addDays(brusselsDay(now), 1);
	const [y, m, d] = tomorrow.split('-').map(Number);
	// Minuit à Bruxelles = 22 h ou 23 h UTC la veille selon l'heure d'été : on teste les deux.
	for (const offsetH of [1, 2]) {
		const t = Date.UTC(y, m - 1, d, 0 - offsetH);
		if (brusselsDay(t) === tomorrow && hourFmt.format(new Date(t)) === '00') return t;
	}
	return Date.UTC(y, m - 1, d) - 3_600_000;
}

/** Instant du prochain lundi minuit à Bruxelles. */
export function nextBrusselsMonday(now: number) {
	let t = nextBrusselsMidnight(now);
	while (brusselsWeek(t) === brusselsWeek(now)) t = nextBrusselsMidnight(t + 1000);
	return t;
}
