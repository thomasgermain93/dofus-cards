/**
 * Modération minimale : filtre d'insultes (pseudos, guildes, messages) et
 * limite de débit en mémoire (un seul processus Node, suffisant pour le MVP).
 */

// Liste volontairement courte et sobre, à compléter. Comparée sur un texte normalisé
// (minuscules, sans accents, chiffres « leet » convertis, lettres répétées réduites).
const BAD_WORDS = [
	'connard', 'connasse', 'salope', 'salaud', 'encule', 'enculer', 'pute', 'putain', 'batard', 'batarde',
	'nique', 'niquer', 'ntm', 'fdp', 'pd', 'pede', 'tapette', 'gouine', 'negro', 'negre', 'bougnoule',
	'youpin', 'bicot', 'raton', 'chintok', 'nazi', 'hitler', 'retarde', 'mongol', 'trisomique', 'abruti',
	'debile', 'pouffiasse', 'catin', 'merde', 'couille', 'bite', 'chatte', 'fuck', 'shit', 'bitch', 'nigger',
	'nigga', 'faggot', 'whore', 'cunt', 'kys', 'suicide'
];

// Mots assez longs et spécifiques pour être cherchés à l'intérieur d'un pseudo
// (« nique » ou « pute » ne le sont pas : unique, dispute...).
const SUBSTRING_WORDS = ['conard', 'conase', 'salope', 'encule', 'batard', 'negre', 'negro', 'bougnoule', 'youpin', 'hitler', 'nazi', 'poufiase', 'enculer'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

export function normalize(text: string) {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[013457@$]/g, (c) => LEET[c] ?? c)
		.replace(/(.)\1+/g, '$1');
}

const wordRe = new RegExp(`(^|[^a-z])(${BAD_WORDS.map((w) => w.replace(/(.)\1+/g, '$1')).join('|')})(?=$|[^a-z])`, 'g');

/** Vrai si le texte contient une insulte (mot entier). */
export function isOffensive(text: string) {
	wordRe.lastIndex = 0;
	return wordRe.test(normalize(text));
}

/** Pour les pseudos / noms de guilde : on bloque aussi les insultes collées (« xxconnardxx »). */
export function isOffensiveName(text: string) {
	const n = normalize(text).replace(/[^a-z]/g, '');
	return SUBSTRING_WORDS.some((w) => n.includes(w)) || isOffensive(text);
}

/** Masque les insultes d'un message (remplacées par des astérisques). */
export function censor(text: string) {
	return text
		.split(/(\s+)/)
		.map((part) => (part.trim() && isOffensive(part) ? '*'.repeat(Math.min(8, part.length)) : part))
		.join('');
}

/* ------------------------------------------------------------------ */

const buckets = new Map<string, { tokens: number; at: number }>();

/**
 * Seau à jetons : `limit` actions par `windowMs`, par clé (ex. "msg:42").
 * Renvoie false si l'action doit être refusée.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
	const b = buckets.get(key) ?? { tokens: limit, at: now };
	b.tokens = Math.min(limit, b.tokens + ((now - b.at) / windowMs) * limit);
	b.at = now;
	if (b.tokens < 1) {
		buckets.set(key, b);
		return false;
	}
	b.tokens -= 1;
	buckets.set(key, b);
	if (buckets.size > 50_000) buckets.clear();
	return true;
}
