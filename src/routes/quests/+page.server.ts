import { getDb } from '#lib/server/db';
import { retentionSummary } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ retention: retentionSummary(getDb(), locals.user!.id) });
