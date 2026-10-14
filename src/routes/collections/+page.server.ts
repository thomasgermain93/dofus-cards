import { getDb } from '#lib/server/db';
import { claimCollection, userCollections, KIND_LABEL } from '#lib/server/game/collections';
import { cryptoRng } from '#lib/server/game/rng';
import { run, str } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const kind = ['region', 'donjon', 'panoplie'].includes(url.searchParams.get('kind') ?? '') ? url.searchParams.get('kind')! : 'region';
	const sort = url.searchParams.get('sort') === 'name' ? 'name' : 'progress';
	const all = userCollections(getDb(), locals.user!.id);
	const list = all
		.filter((c) => c.kind === kind)
		.map(({ cardIds, rarities, ...c }) => ({ ...c, size: cardIds.length }))
		.sort((a, b) =>
			sort === 'name'
				? a.name.localeCompare(b.name, 'fr')
				: Number(a.claimed) - Number(b.claimed) || Number(b.complete) - Number(a.complete) || b.have / b.total - a.have / a.total || a.total - b.total
		);
	const stats = (['region', 'donjon', 'panoplie'] as const).map((k) => {
		const of = all.filter((c) => c.kind === k);
		return { kind: k, label: KIND_LABEL[k], total: of.length, complete: of.filter((c) => c.complete).length, toClaim: of.filter((c) => c.complete && !c.claimed).length };
	});
	return { kind, sort, list, stats };
};

export const actions: Actions = {
	claim: async ({ locals, request }) => {
		const f = await request.formData();
		return run(locals, (uid) => ({ claimed: claimCollection(getDb(), uid, str(f.get('key')), cryptoRng) }));
	}
};
