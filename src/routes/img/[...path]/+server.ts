import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { dataDir } from '#lib/server/db';
import type { RequestHandler } from './$types';

/** Images des cartes, servies depuis notre cache local (DATA_DIR/images). */
export const GET: RequestHandler = async ({ params }) => {
	const rel = normalize(params.path);
	if (rel.startsWith('..') || !/^[a-z]+\/[A-Za-z0-9_.-]+\.png$/.test(rel)) error(404);
	try {
		const buf = await readFile(join(dataDir(), 'images', rel));
		return new Response(buf, {
			headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' }
		});
	} catch {
		error(404);
	}
};
