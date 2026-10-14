import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { acceptTrade, cancelTrade, declineTrade, type TradeRow } from '#lib/server/game/trades';
import { parseIds } from '#lib/server/game/core';
import { cardsByIds } from '#lib/server/queries';
import { int, run } from '#lib/server/web';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const t = db
		.prepare('SELECT t.*, uf.username from_name, ut.username to_name FROM trades t JOIN users uf ON uf.id = t.from_id JOIN users ut ON ut.id = t.to_id WHERE t.id = ?')
		.get(int(params.id)) as (TradeRow & { from_name: string; to_name: string }) | undefined;
	if (!t || (t.from_id !== uid && t.to_id !== uid)) error(404, 'Échange introuvable');
	return { trade: t, offer: cardsByIds(db, parseIds(t.offer_cards)), request: cardsByIds(db, parseIds(t.request_cards)) };
};

export const actions: Actions = {
	accept: ({ locals, params }) => run(locals, (uid) => (acceptTrade(getDb(), int(params.id), uid), { done: 'accepted' })),
	decline: ({ locals, params }) => run(locals, (uid) => (declineTrade(getDb(), int(params.id), uid), { done: 'declined' })),
	cancel: ({ locals, params }) => run(locals, (uid) => (cancelTrade(getDb(), int(params.id), uid), { done: 'cancelled' }))
};
