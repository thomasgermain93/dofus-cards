import type { DB } from '../db';
import type { BoosterKind } from './constants';
import { addKamas, assert, notify } from './core';
import { brusselsDay, brusselsWeek } from './time';
import { STARTER_LABELS } from './starter';

/**
 * Quêtes du jour (3, renouvelées à minuit à Bruxelles) et de la semaine (3,
 * renouvelées le lundi). Tirage déterministe par joueur et par période.
 */

export type QuestEvent =
	| 'pack'
	| 'sell'
	| 'recycle'
	| 'new_card'
	| 'rare_card'
	| 'monster_card'
	| 'duel_play'
	| 'duel_win'
	| 'bid'
	| 'trade'
	| 'craft'
	| 'quest_done';

export interface QuestDef {
	code: string;
	event: QuestEvent;
	target: number;
	label: string;
	kamas: number;
	fragments?: number;
	booster?: BoosterKind;
}

export const DAILY_POOL: QuestDef[] = [
	{ code: 'd-pack-3', event: 'pack', target: 3, label: 'Ouvrir 3 paquets', kamas: 40 },
	{ code: 'd-pack-6', event: 'pack', target: 6, label: 'Ouvrir 6 paquets', kamas: 80, fragments: 20 },
	{ code: 'd-sell-5', event: 'sell', target: 5, label: 'Vendre 5 cartes au jeu', kamas: 30 },
	{ code: 'd-recycle-3', event: 'recycle', target: 3, label: 'Recycler 3 cartes en fragments', kamas: 20, fragments: 20 },
	{ code: 'd-new-5', event: 'new_card', target: 5, label: 'Obtenir 5 nouvelles cartes', kamas: 50 },
	{ code: 'd-rare-1', event: 'rare_card', target: 1, label: 'Tirer une carte Rare ou mieux', kamas: 60 },
	{ code: 'd-monster-6', event: 'monster_card', target: 6, label: 'Tirer 6 cartes de monstres', kamas: 40 },
	{ code: 'd-duel-1', event: 'duel_play', target: 1, label: 'Terminer un duel', kamas: 50 },
	{ code: 'd-win-1', event: 'duel_win', target: 1, label: 'Gagner un duel', kamas: 80 },
	{ code: 'd-bid-1', event: 'bid', target: 1, label: 'Placer une enchère', kamas: 40 }
];

export const WEEKLY_POOL: QuestDef[] = [
	{ code: 'w-quests-10', event: 'quest_done', target: 10, label: 'Terminer 10 quêtes du jour', kamas: 200, booster: 'gold' },
	{ code: 'w-pack-25', event: 'pack', target: 25, label: 'Ouvrir 25 paquets', kamas: 150, booster: 'silver' },
	{ code: 'w-win-5', event: 'duel_win', target: 5, label: 'Gagner 5 duels', kamas: 150, booster: 'silver' },
	{ code: 'w-new-30', event: 'new_card', target: 30, label: 'Obtenir 30 nouvelles cartes', kamas: 200, fragments: 100 },
	{ code: 'w-sell-40', event: 'sell', target: 40, label: 'Vendre 40 cartes au jeu', kamas: 150 },
	{ code: 'w-craft-1', event: 'craft', target: 1, label: 'Fabriquer une carte', kamas: 100, fragments: 100 },
	{ code: 'w-trade-1', event: 'trade', target: 1, label: 'Réussir un échange', kamas: 150, fragments: 50 }
];

const DAILY_COUNT = 3;
const WEEKLY_COUNT = 3;

/** Hachage simple et stable (FNV-1a) pour un tirage déterministe. */
function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** Choix des quêtes d'une période : toujours le même pour un joueur et une période donnés. */
export function pickQuests(pool: QuestDef[], count: number, seed: string, first?: string): QuestDef[] {
	const fixed = first ? pool.filter((q) => q.code === first) : [];
	const rest = pool
		.filter((q) => q.code !== first)
		.map((q) => ({ q, k: hash(`${seed}:${q.code}`) }))
		.sort((a, b) => a.k - b.k)
		.map((x) => x.q);
	// Pas deux quêtes sur le même événement le même jour
	const out: QuestDef[] = [...fixed];
	for (const q of rest) {
		if (out.length >= count) break;
		if (!out.some((o) => o.event === q.event)) out.push(q);
	}
	return out;
}

export interface QuestRow {
	id: number;
	period: 'day' | 'week' | 'starter';
	period_key: string;
	code: string;
	event: QuestEvent;
	target: number;
	progress: number;
	reward_kamas: number;
	reward_fragments: number;
	reward_booster: BoosterKind | null;
	claimed_at: number | null;
}

/** Crée les quêtes de la période en cours si elles n'existent pas encore. */
export function ensureQuests(db: DB, userId: number, now = Date.now()) {
	const day = brusselsDay(now);
	const week = brusselsWeek(now);
	const ins = db.prepare(
		`INSERT OR IGNORE INTO quests (user_id, period, period_key, code, event, target, reward_kamas, reward_fragments, reward_booster)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const has = (period: string, key: string) =>
		!!db.prepare('SELECT 1 FROM quests WHERE user_id = ? AND period = ? AND period_key = ? LIMIT 1').get(userId, period, key);
	// Nouveaux joueurs (3 premiers jours) : « Ouvrir 3 paquets » est toujours proposé (étape du tutoriel)
	const createdAt = (db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId) as { created_at: number } | undefined)?.created_at ?? 0;
	const newbie = now - createdAt < 3 * 86_400_000;
	if (!has('day', day))
		for (const q of pickQuests(DAILY_POOL, DAILY_COUNT, `${userId}:${day}`, newbie ? 'd-pack-3' : undefined))
			ins.run(userId, 'day', day, q.code, q.event, q.target, q.kamas, q.fragments ?? 0, q.booster ?? null);
	if (!has('week', week))
		for (const q of pickQuests(WEEKLY_POOL, WEEKLY_COUNT, `${userId}:${week}`, 'w-quests-10'))
			ins.run(userId, 'week', week, q.code, q.event, q.target, q.kamas, q.fragments ?? 0, q.booster ?? null);
	return { day, week };
}

export function listQuests(db: DB, userId: number, now = Date.now()) {
	const { day, week } = ensureQuests(db, userId, now);
	const rows = db
		.prepare("SELECT * FROM quests WHERE user_id = ? AND ((period = ? AND period_key = ?) OR (period = ? AND period_key = ?) OR period = 'starter') ORDER BY period, id")
		.all(userId, 'day', day, 'week', week) as QuestRow[];
	const label = (code: string) => [...DAILY_POOL, ...WEEKLY_POOL].find((q) => q.code === code)?.label ?? STARTER_LABELS[code] ?? code;
	return rows.map((r) => ({ ...r, label: label(r.code), done: r.progress >= r.target }));
}

/** Fait avancer les quêtes concernées par un événement de jeu. */
export function track(db: DB, userId: number, event: QuestEvent, amount = 1, now = Date.now()) {
	if (amount <= 0) return;
	const { day, week } = ensureQuests(db, userId, now);
	const rows = db
		.prepare(
			`SELECT id, code, progress, target, notified FROM quests WHERE user_id = ? AND event = ? AND claimed_at IS NULL
			 AND ((period = 'day' AND period_key = ?) OR (period = 'week' AND period_key = ?) OR period = 'starter')`
		)
		.all(userId, event, day, week) as { id: number; code: string; progress: number; target: number; notified: number }[];
	const upd = db.prepare('UPDATE quests SET progress = ?, notified = ? WHERE id = ?');
	for (const r of rows) {
		if (r.progress >= r.target) continue;
		const p = Math.min(r.target, r.progress + amount);
		const done = p >= r.target;
		upd.run(p, done ? 1 : r.notified, r.id);
		if (done && !r.notified) {
			const label = [...DAILY_POOL, ...WEEKLY_POOL].find((q) => q.code === r.code)?.label ?? STARTER_LABELS[r.code] ?? 'Quête';
			notify(db, userId, 'quest', `Quête terminée : ${label}. Viens récupérer ta récompense !`, '/quests', now);
		}
	}
}

export function addBooster(db: DB, userId: number, kind: BoosterKind, qty = 1) {
	db.prepare('INSERT INTO boosters (user_id, kind, qty) VALUES (?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET qty = qty + excluded.qty').run(
		userId,
		kind,
		qty
	);
}

export function addFragments(db: DB, userId: number, delta: number) {
	if (!delta) return;
	const r = db.prepare('UPDATE users SET fragments = fragments + ? WHERE id = ? AND fragments + ? >= 0').run(delta, userId, delta);
	assert(r.changes === 1, 'Pas assez de fragments.');
}

/** Récupère la récompense d'une quête terminée. */
export function claimQuest(db: DB, userId: number, questId: number, now = Date.now()) {
	return db.transaction(() => {
		const q = db.prepare('SELECT * FROM quests WHERE id = ? AND user_id = ?').get(questId, userId) as QuestRow | undefined;
		assert(q, 'Quête introuvable.');
		assert(q.claimed_at == null, 'Récompense déjà récupérée.');
		assert(q.progress >= q.target, 'Quête pas encore terminée.');
		const { day, week } = ensureQuests(db, userId, now);
		assert(q.period === 'starter' || q.period_key === (q.period === 'day' ? day : week), 'Cette quête a expiré.');
		db.prepare('UPDATE quests SET claimed_at = ? WHERE id = ?').run(now, questId);
		if (q.reward_kamas) addKamas(db, userId, q.reward_kamas, `quest:${q.code}`, now);
		if (q.reward_fragments) addFragments(db, userId, q.reward_fragments);
		if (q.reward_booster) addBooster(db, userId, q.reward_booster);
		if (q.period === 'day') track(db, userId, 'quest_done', 1, now);
		return { kamas: q.reward_kamas, fragments: q.reward_fragments, booster: q.reward_booster };
	})();
}
