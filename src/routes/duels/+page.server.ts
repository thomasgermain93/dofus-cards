import { getDb } from '#lib/server/db';
import { BOT_NAME } from '#lib/server/game/duels';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	const uid = locals.user!.id;
	const duels = db
		.prepare(
			`SELECT d.id, d.status, d.vs_bot, d.result, d.winner_id, d.challenger_id, d.opponent_id, d.created_at, d.finished_at,
				uc.username challenger, uo.username opponent,
				(SELECT COUNT(*) FROM duel_questions q WHERE q.duel_id = d.id AND q.answerer_id = ? AND q.answer IS NULL) todo
			 FROM duels d JOIN users uc ON uc.id = d.challenger_id LEFT JOIN users uo ON uo.id = d.opponent_id
			 WHERE (d.challenger_id = ? OR d.opponent_id = ?) AND d.status <> 'cancelled'
			 ORDER BY CASE WHEN d.status IN ('pending','active') THEN 0 ELSE 1 END, d.id DESC LIMIT 40`
		)
		.all(uid, uid, uid) as {
		id: number; status: string; vs_bot: number; result: string | null; winner_id: number | null; challenger_id: number;
		opponent_id: number | null; created_at: number; finished_at: number | null; challenger: string; opponent: string | null; todo: number;
	}[];
	const stats = db
		.prepare("SELECT SUM(winner_id = ?) wins, SUM(result = 'draw') draws, COUNT(*) played FROM duels WHERE status = 'done' AND (challenger_id = ? OR opponent_id = ?)")
		.get(uid, uid, uid) as { wins: number | null; draws: number | null; played: number };
	return { duels, stats, botName: BOT_NAME };
};
