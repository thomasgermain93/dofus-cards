import { describe, it, expect } from 'vitest';
import { createAuction, placeBid, settleExpiredAuctions, cancelAuction, minNextBid } from '../game/auctions';
import { createTrade, acceptTrade, declineTrade } from '../game/trades';
import { testDb, addUser, give, kamas, copies } from './fixtures';

const H = 3_600_000;

describe('enchères', () => {
	it('enchère complète : réservation, remboursement du battu, clôture et transfert', () => {
		const db = testDb();
		const seller = addUser(db, 'seller', 0);
		const b1 = addUser(db, 'b1', 1000);
		const b2 = addUser(db, 'b2', 1000);
		give(db, seller, 5);
		const id = createAuction(db, seller, 5, 100, 1, 0);
		expect(() => placeBid(db, id, b1, 99, 1)).toThrow(/minimale/);
		placeBid(db, id, b1, 100, 1);
		expect(kamas(db, b1)).toBe(900);
		expect(() => placeBid(db, id, b2, 104, 2)).toThrow(/minimale/); // +5 %
		placeBid(db, id, b2, 105, 2);
		expect(kamas(db, b1)).toBe(1000); // remboursé
		expect(kamas(db, b2)).toBe(895);
		expect(settleExpiredAuctions(db, H - 1)).toBe(0);
		expect(settleExpiredAuctions(db, H)).toBe(1);
		expect(copies(db, seller, 5)).toBe(0);
		expect(copies(db, b2, 5)).toBe(1);
		expect(kamas(db, seller)).toBe(105);
		expect(() => placeBid(db, id, b1, 500, H + 1)).toThrow(/terminée/);
	});
	it('sans enchère, la carte revient au vendeur', () => {
		const db = testDb();
		const s = addUser(db, 's');
		give(db, s, 7);
		createAuction(db, s, 7, 10, 1, 0);
		const locked = db.prepare('SELECT locked FROM user_cards WHERE user_id = ?').get(s) as { locked: string };
		expect(locked.locked).toBe('auction');
		settleExpiredAuctions(db, H);
		expect((db.prepare('SELECT locked FROM user_cards WHERE user_id = ?').get(s) as { locked: string | null }).locked).toBeNull();
	});
	it('interdit d’enchérir sur sa propre vente, sans kamas, ou de vendre une carte bloquée', () => {
		const db = testDb();
		const s = addUser(db, 's', 1000);
		const poor = addUser(db, 'poor', 5);
		give(db, s, 7);
		const id = createAuction(db, s, 7, 10, 1, 0);
		expect(() => placeBid(db, id, s, 10, 1)).toThrow(/propre/);
		expect(() => placeBid(db, id, poor, 10, 1)).toThrow(/kamas/);
		expect(() => createAuction(db, s, 7, 10, 1, 0)).toThrow(/possèdes/);
	});
	it('annulation possible seulement sans enchère ; anti-sniping', () => {
		const db = testDb();
		const s = addUser(db, 's');
		const b = addUser(db, 'b', 1000);
		give(db, s, 7, 2);
		const a1 = createAuction(db, s, 7, 10, 1, 0);
		cancelAuction(db, a1, s);
		const a2 = createAuction(db, s, 7, 10, 1, 0);
		placeBid(db, a2, b, 10, H - 1000);
		expect(() => cancelAuction(db, a2, s)).toThrow(/annuler/);
		const ends = (db.prepare('SELECT ends_at FROM auctions WHERE id = ?').get(a2) as { ends_at: number }).ends_at;
		expect(ends).toBe(H - 1000 + 120_000);
		expect(minNextBid({ current_bid: 10, start_price: 10 })).toBe(11);
	});
});

describe('échanges', () => {
	it('transfert atomique cartes + kamas contre cartes', () => {
		const db = testDb();
		const a = addUser(db, 'a', 500);
		const b = addUser(db, 'b', 0);
		give(db, a, 1);
		give(db, a, 2);
		give(db, b, 3);
		const t = createTrade(db, a, b, [1, 2], 200, [3], null, 0);
		acceptTrade(db, t, b, 1);
		expect(copies(db, a, 1)).toBe(0);
		expect(copies(db, b, 1)).toBe(1);
		expect(copies(db, b, 2)).toBe(1);
		expect(copies(db, a, 3)).toBe(1);
		expect(kamas(db, a)).toBe(300);
		expect(kamas(db, b)).toBe(200);
	});
	it('si une carte a disparu entre-temps, rien ne bouge', () => {
		const db = testDb();
		const a = addUser(db, 'a', 500);
		const b = addUser(db, 'b', 0);
		give(db, a, 1);
		give(db, b, 3);
		const t = createTrade(db, a, b, [1], 100, [3], null, 0);
		db.prepare('DELETE FROM user_cards WHERE user_id = ? AND card_id = 1').run(a);
		expect(() => acceptTrade(db, t, b, 1)).toThrow(/ne possède plus/);
		expect(copies(db, b, 3)).toBe(1);
		expect(kamas(db, a)).toBe(500);
		expect((db.prepare('SELECT status FROM trades WHERE id = ?').get(t) as { status: string }).status).toBe('pending');
	});
	it('seul le destinataire peut accepter ou refuser', () => {
		const db = testDb();
		const a = addUser(db, 'a', 500);
		const b = addUser(db, 'b', 0);
		give(db, a, 1);
		give(db, b, 3);
		const t = createTrade(db, a, b, [1], 0, [3], null, 0);
		expect(() => acceptTrade(db, t, a, 1)).toThrow();
		declineTrade(db, t, b, 1);
		expect(() => acceptTrade(db, t, b, 1)).toThrow(/plus en attente/);
	});
	it('refuse une proposition avec des cartes non possédées', () => {
		const db = testDb();
		const a = addUser(db, 'a');
		const b = addUser(db, 'b');
		give(db, b, 3);
		expect(() => createTrade(db, a, b, [1], 0, [3], null, 0)).toThrow();
	});
});
