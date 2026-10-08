import { getDb } from '#lib/server/db';
import { discardAllDuplicates } from '#lib/server/game/collection';
import { CARD_COLS, int, limit, run } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';
import type { CardView } from '#lib/types';

const PER_PAGE = 60;
const SORTS: Record<string, string> = {
	rarity: 'c.rarity DESC, c.level DESC, c.name',
	level: 'c.level DESC, c.rarity DESC, c.name',
	name: 'c.name COLLATE NOCASE',
	attack: 'c.attack DESC',
	defense: 'c.defense DESC',
	recent: 'last_obtained DESC, c.rarity DESC'
};

export const load: PageServerLoad = ({ locals, url }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const p = url.searchParams;
	const cat = ['monster', 'item', 'mount', 'class'].includes(p.get('cat') ?? '') ? p.get('cat')! : 'all';
	const own = ['owned', 'missing', 'dupes', 'fav'].includes(p.get('own') ?? '') ? p.get('own')! : 'all';
	const rarity = int(p.get('r'), -1);
	const q = (p.get('q') ?? '').trim().slice(0, 60);
	const sort = SORTS[p.get('sort') ?? ''] ? p.get('sort')! : 'rarity';
	const pageNo = Math.max(1, int(p.get('page'), 1));

	const where = ['c.active = 1'];
	const args: unknown[] = [uid, uid];
	if (cat !== 'all') (where.push('c.category = ?'), args.push(cat));
	if (rarity >= 0 && rarity <= 5) (where.push('c.rarity = ?'), args.push(rarity));
	if (q) (where.push("norm(c.name) LIKE '%' || norm(?) || '%'"), args.push(q));
	const having = { all: '', owned: 'HAVING cnt > 0', missing: 'HAVING cnt = 0', dupes: 'HAVING cnt > 1', fav: 'HAVING fav = 1' }[own];

	const base = `SELECT ${CARD_COLS}, COUNT(uc.id) cnt, MAX(uc.obtained_at) last_obtained, (f.card_id IS NOT NULL) fav
		FROM cards c
		LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ?
		LEFT JOIN favorites f ON f.card_id = c.id AND f.user_id = ?
		WHERE ${where.join(' AND ')} GROUP BY c.id ${having}`;
	const total = (db.prepare(`SELECT COUNT(*) n FROM (${base})`).get(...args) as { n: number }).n;
	const cards = db.prepare(`${base} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`).all(...args, PER_PAGE, (pageNo - 1) * PER_PAGE) as (CardView & {
		cnt: number;
		fav: number;
	})[];

	const completion = db
		.prepare(
			`SELECT c.category, COUNT(*) total, SUM(EXISTS(SELECT 1 FROM user_cards uc WHERE uc.user_id = ? AND uc.card_id = c.id)) owned
			 FROM cards c WHERE c.active = 1 GROUP BY c.category`
		)
		.all(uid) as { category: string; total: number; owned: number }[];
	const dupes = db
		.prepare('SELECT COUNT(*) n FROM (SELECT card_id, COUNT(*) k FROM user_cards WHERE user_id = ? GROUP BY card_id HAVING k > 1)')
		.get(uid) as { n: number };

	return { cards, total, pages: Math.max(1, Math.ceil(total / PER_PAGE)), pageNo, filters: { cat, own, rarity, q, sort }, completion, dupes: dupes.n };
};

export const actions: Actions = {
	discardAll: async ({ locals, request }) => {
		const f = await request.formData();
		const max = Math.min(5, Math.max(0, int(f.get('max'), 2)));
		return run(locals, (uid) => {
			limit(`discard:${uid}`, 10, 60_000);
			return { discarded: discardAllDuplicates(getDb(), uid, max) };
		});
	}
};
