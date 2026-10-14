import type { DB } from '../db';
import { HUNT_REWARD, ONBOARDING_REWARD } from './constants';
import { addKamas, assert, getUser, grantCard, notify } from './core';
import { addBooster, addFragments } from './quests';
import { brusselsDay } from './time';
import type { Rng } from './rng';

/**
 * Premières minutes : tutoriel guidé en 5 étapes (sautable), booster de bienvenue garanti Rare ou mieux,
 * objectifs de bienvenue pour les 3 premiers jours. Étapes calculées à partir de l'état réel du joueur.
 */

export const STEPS = [
	{ key: 'pack', title: 'Ouvre ton booster de bienvenue', text: 'Une carte Rare ou mieux est garantie !', href: '/#paquets', cta: 'Ouvrir' },
	{ key: 'sell', title: 'Vends une carte en trop', text: 'Les doublons se revendent en kamas en un geste.', href: '/album?own=owned', cta: 'Mon album' },
	{ key: 'quest', title: 'Récupère une quête', text: 'Ouvre 3 paquets puis récupère la récompense.', href: '/quests', cta: 'Quêtes' },
	{ key: 'album', title: 'Explore ton album', text: 'Les silhouettes, ce sont les cartes à trouver.', href: '/album', cta: 'Album' },
	{ key: 'showcase', title: 'Compose ta vitrine', text: 'Montre tes plus belles cartes sur ton profil.', href: '/profile/edit#vitrines', cta: 'Ma vitrine' }
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

export const STARTER_QUESTS = [
	{ code: 's-pack-10', event: 'pack', target: 10, kamas: 150, fragments: 0, booster: null },
	{ code: 's-win-1', event: 'duel_win', target: 1, kamas: 50, fragments: 0, booster: 'bronze' },
	{ code: 's-new-25', event: 'new_card', target: 25, kamas: 100, fragments: 50, booster: null }
] as const;

/** À l'inscription : tutoriel actif, booster de bienvenue, objectifs des 3 premiers jours. */
export function startOnboarding(db: DB, userId: number) {
	db.prepare("UPDATE users SET onboarding = 'active', onboarding_flags = '[]' WHERE id = ?").run(userId);
	addBooster(db, userId, 'welcome', 1);
	const ins = db.prepare(
		`INSERT OR IGNORE INTO quests (user_id, period, period_key, code, event, target, reward_kamas, reward_fragments, reward_booster) VALUES (?, 'starter', 'starter', ?, ?, ?, ?, ?, ?)`
	);
	for (const q of STARTER_QUESTS) ins.run(userId, q.code, q.event, q.target, q.kamas, q.fragments, q.booster);
}

function flags(db: DB, userId: number): string[] {
	try {
		return JSON.parse((db.prepare('SELECT onboarding_flags f FROM users WHERE id = ?').get(userId) as { f: string }).f || '[]') as string[];
	} catch {
		return [];
	}
}

/** État des étapes à partir des données réelles. */
export function onboardingState(db: DB, userId: number) {
	const u = db.prepare('SELECT onboarding FROM users WHERE id = ?').get(userId) as { onboarding: string };
	if (u.onboarding !== 'active') return null;
	const f = flags(db, userId);
	const has = (sql: string) => !!db.prepare(sql).get(userId);
	const done: Record<StepKey, boolean> = {
		pack: has('SELECT 1 FROM pack_openings WHERE user_id = ? LIMIT 1'),
		sell: has("SELECT 1 FROM ledger WHERE user_id = ? AND (reason LIKE 'sell:%' OR reason LIKE 'recycle:%') LIMIT 1"),
		quest: has("SELECT 1 FROM quests WHERE user_id = ? AND claimed_at IS NOT NULL AND period IN ('day', 'week') LIMIT 1"),
		album: f.includes('album'),
		showcase: has('SELECT 1 FROM showcase_cards sc JOIN showcases s ON s.id = sc.showcase_id WHERE s.user_id = ? LIMIT 1')
	};
	const steps = STEPS.map((s) => ({ ...s, done: done[s.key] }));
	const current = steps.findIndex((s) => !s.done);
	return { steps, current, finished: current === -1, reward: ONBOARDING_REWARD };
}

export function markVisited(db: DB, userId: number, flag: 'album') {
	const f = flags(db, userId);
	if (!f.includes(flag)) db.prepare('UPDATE users SET onboarding_flags = ? WHERE id = ?').run(JSON.stringify([...f, flag]), userId);
}

/** Termine le tutoriel (toutes les étapes faites) et donne la récompense de bienvenue. */
export function finishOnboarding(db: DB, userId: number, now = Date.now()) {
	return db.transaction(() => {
		const st = onboardingState(db, userId);
		assert(st, 'Tutoriel déjà terminé.');
		assert(st.finished, 'Il reste des étapes à faire.');
		db.prepare("UPDATE users SET onboarding = 'done' WHERE id = ?").run(userId);
		addKamas(db, userId, ONBOARDING_REWARD.kamas, 'onboarding', now);
		addFragments(db, userId, ONBOARDING_REWARD.fragments);
		notify(db, userId, 'onboarding', `Tutoriel terminé : +${ONBOARDING_REWARD.kamas} kamas et +${ONBOARDING_REWARD.fragments} fragments !`, '/', now);
		return ONBOARDING_REWARD;
	})();
}

export function skipOnboarding(db: DB, userId: number) {
	db.prepare("UPDATE users SET onboarding = 'skipped' WHERE id = ? AND onboarding = 'active'").run(userId);
}

/* ------------------------------------------------------------------ */
/* Chasse aux cartes : une carte mystère cachée chaque jour sur une page */
/* ------------------------------------------------------------------ */

export const HUNT_PAGES = ['/album', '/market', '/duels', '/social', '/collections', '/leaderboard', '/quests', '/achievements'];

function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

/** Page du jour où se cache la carte mystère (différente pour chaque joueur), ou null si déjà trouvée. */
export function huntPage(db: DB, userId: number, now = Date.now()) {
	const day = brusselsDay(now);
	if (getUser(db, userId).hunt_day === day) return null;
	return HUNT_PAGES[hash(`${userId}:${day}`) % HUNT_PAGES.length];
}

export function claimHunt(db: DB, userId: number, path: string, rng: Rng, now = Date.now()) {
	return db.transaction(() => {
		const page = huntPage(db, userId, now);
		assert(page, 'Tu as déjà trouvé la carte mystère aujourd’hui. Reviens demain !');
		assert(path === page, 'La carte mystère ne se cache pas ici.');
		db.prepare('UPDATE users SET hunt_day = ? WHERE id = ?').run(brusselsDay(now), userId);
		addKamas(db, userId, HUNT_REWARD.kamas, 'hunt', now);
		addFragments(db, userId, HUNT_REWARD.fragments);
		// 1 chance sur 4 de trouver aussi une carte Rare ou mieux
		let card: { id: number; name: string } | null = null;
		if (rng() < 0.25) {
			const n = (db.prepare('SELECT COUNT(*) n FROM cards WHERE active = 1 AND rarity >= 2').get() as { n: number }).n;
			card = db.prepare('SELECT id, name FROM cards WHERE active = 1 AND rarity >= 2 ORDER BY id LIMIT 1 OFFSET ?').get(Math.floor(rng() * n)) as { id: number; name: string };
			grantCard(db, userId, card.id, now);
		}
		return { ...HUNT_REWARD, card };
	})();
}
