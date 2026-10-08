import type Database from 'better-sqlite3';

/**
 * Migrations SQL, appliquées dans l'ordre. Ne jamais modifier une migration
 * déjà déployée : en ajouter une nouvelle à la fin du tableau.
 */
export const MIGRATIONS: string[] = [
	/* 1 : schéma initial */ `
	CREATE TABLE cards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		key TEXT NOT NULL UNIQUE,            -- ex. monster:58, item:694, class:1
		source_id INTEGER NOT NULL,
		category TEXT NOT NULL,              -- monster | item | mount | class
		subtype TEXT NOT NULL,               -- ex. Boss, Archimonstre, Chapeau, Dofus, Dragodinde
		name TEXT NOT NULL,
		image TEXT,                          -- chemin relatif dans DATA_DIR/images
		level INTEGER NOT NULL DEFAULT 0,
		rarity INTEGER NOT NULL,             -- 0 Commune .. 5 Légendaire
		attack INTEGER NOT NULL,
		defense INTEGER NOT NULL,
		info1 TEXT,                          -- ligne d'info principale (zone, panoplie, famille...)
		info2 TEXT,
		facts TEXT NOT NULL DEFAULT '{}',    -- JSON des faits utilisés pour le quiz
		prestige REAL NOT NULL DEFAULT 0,
		active INTEGER NOT NULL DEFAULT 1,
		updated_at INTEGER NOT NULL
	);
	CREATE INDEX cards_rarity ON cards(active, rarity);
	CREATE INDEX cards_category ON cards(category);

	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE COLLATE NOCASE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'player', -- player | admin
		banned INTEGER NOT NULL DEFAULT 0,
		ban_reason TEXT,
		kamas INTEGER NOT NULL DEFAULT 0,
		xp INTEGER NOT NULL DEFAULT 0,
		pack_stock INTEGER NOT NULL DEFAULT 0,
		pack_anchor INTEGER NOT NULL,        -- ms : début de la recharge en cours
		daily_last TEXT,                     -- AAAA-MM-JJ de la dernière récompense quotidienne
		daily_streak INTEGER NOT NULL DEFAULT 0,
		bio TEXT,
		guild_id INTEGER REFERENCES guilds(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE sessions (
		id TEXT PRIMARY KEY,                 -- sha256 du jeton
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	);

	-- Un exemplaire de carte possédé (les doublons = plusieurs lignes)
	CREATE TABLE user_cards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		card_id INTEGER NOT NULL REFERENCES cards(id),
		locked TEXT,                         -- NULL | 'auction'
		obtained_at INTEGER NOT NULL
	);
	CREATE INDEX user_cards_owner ON user_cards(user_id, card_id);

	CREATE TABLE favorites (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		card_id INTEGER NOT NULL REFERENCES cards(id),
		PRIMARY KEY (user_id, card_id)
	);

	CREATE TABLE pack_openings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		card_ids TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE auctions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		seller_id INTEGER NOT NULL REFERENCES users(id),
		user_card_id INTEGER NOT NULL,          -- exemplaire bloqué (pas de FK : il peut être revendu après la vente)
		card_id INTEGER NOT NULL REFERENCES cards(id),
		start_price INTEGER NOT NULL,
		current_bid INTEGER,
		bidder_id INTEGER REFERENCES users(id),
		bid_count INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'open', -- open | sold | unsold | cancelled
		ends_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX auctions_open ON auctions(status, ends_at);

	CREATE TABLE bids (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		auction_id INTEGER NOT NULL REFERENCES auctions(id),
		user_id INTEGER NOT NULL REFERENCES users(id),
		amount INTEGER NOT NULL,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE trades (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		from_id INTEGER NOT NULL REFERENCES users(id),
		to_id INTEGER NOT NULL REFERENCES users(id),
		offer_cards TEXT NOT NULL DEFAULT '[]',   -- ids de cartes (cards.id) offertes
		offer_kamas INTEGER NOT NULL DEFAULT 0,
		request_cards TEXT NOT NULL DEFAULT '[]', -- ids de cartes demandées
		message TEXT,
		status TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined | cancelled | failed
		created_at INTEGER NOT NULL,
		resolved_at INTEGER
	);

	CREATE TABLE duels (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		challenger_id INTEGER NOT NULL REFERENCES users(id),
		opponent_id INTEGER REFERENCES users(id), -- NULL = ordinateur
		vs_bot INTEGER NOT NULL DEFAULT 0,
		challenger_cards TEXT NOT NULL,           -- JSON [cardId x3]
		opponent_cards TEXT,
		status TEXT NOT NULL DEFAULT 'pending',   -- pending | active | done | declined | cancelled
		challenger_hp INTEGER, opponent_hp INTEGER,
		challenger_max INTEGER, opponent_max INTEGER,
		winner_id INTEGER,
		result TEXT,                              -- challenger | opponent | draw
		created_at INTEGER NOT NULL,
		finished_at INTEGER
	);

	-- Question posée à "answerer_id" sur une carte de l'adversaire
	CREATE TABLE duel_questions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		duel_id INTEGER NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
		answerer_id INTEGER,                      -- NULL = ordinateur
		card_id INTEGER NOT NULL REFERENCES cards(id),
		position INTEGER NOT NULL,
		prompt TEXT NOT NULL,
		choices TEXT NOT NULL,                    -- JSON [4 textes]
		correct INTEGER NOT NULL,                 -- index de la bonne réponse
		answer INTEGER,                           -- index choisi
		answered_at INTEGER
	);
	CREATE INDEX duel_questions_duel ON duel_questions(duel_id, answerer_id, position);

	CREATE TABLE friendships (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		status TEXT NOT NULL,                     -- pending (user_id a demandé) | accepted
		created_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, friend_id)
	);

	CREATE TABLE messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		from_id INTEGER NOT NULL REFERENCES users(id),
		to_id INTEGER NOT NULL REFERENCES users(id),
		body TEXT NOT NULL,
		read_at INTEGER,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX messages_pair ON messages(from_id, to_id, created_at);

	CREATE TABLE guilds (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE COLLATE NOCASE,
		tag TEXT NOT NULL,
		description TEXT,
		leader_id INTEGER NOT NULL REFERENCES users(id),
		created_at INTEGER NOT NULL
	);

	CREATE TABLE guild_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id),
		body TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE achievements_unlocked (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		code TEXT NOT NULL,
		unlocked_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, code)
	);

	-- Points gagnés (nouvelles cartes, victoires) : base du classement hebdomadaire
	CREATE TABLE score_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		kind TEXT NOT NULL,                       -- card | duel
		points INTEGER NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX score_events_time ON score_events(created_at, user_id);

	CREATE TABLE notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		kind TEXT NOT NULL,
		body TEXT NOT NULL,
		link TEXT,
		read_at INTEGER,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX notifications_user ON notifications(user_id, read_at);

	CREATE TABLE ledger (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		delta INTEGER NOT NULL,
		reason TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	`,
	/* 2 : texte d'ambiance des cartes */ `
	ALTER TABLE cards ADD COLUMN flavor TEXT;
	`,
	/* 3 : rétention (quêtes, série, collections, brillantes, fabrication, boosters bonus, coffre, web push) */ `
	ALTER TABLE users ADD COLUMN fragments INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE users ADD COLUMN title TEXT;
	ALTER TABLE users ADD COLUMN streak_best INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE users ADD COLUMN joker_week TEXT;
	ALTER TABLE users ADD COLUMN push_pack_notified INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE user_cards ADD COLUMN shiny INTEGER NOT NULL DEFAULT 0;

	CREATE TABLE boosters (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		kind TEXT NOT NULL,                  -- bronze | silver | gold
		qty INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (user_id, kind)
	);

	CREATE TABLE quests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		period TEXT NOT NULL,                -- day | week
		period_key TEXT NOT NULL,            -- AAAA-MM-JJ (jour, ou lundi de la semaine) heure de Bruxelles
		code TEXT NOT NULL,
		event TEXT NOT NULL,
		target INTEGER NOT NULL,
		progress INTEGER NOT NULL DEFAULT 0,
		reward_kamas INTEGER NOT NULL DEFAULT 0,
		reward_fragments INTEGER NOT NULL DEFAULT 0,
		reward_booster TEXT,
		notified INTEGER NOT NULL DEFAULT 0,
		claimed_at INTEGER,
		UNIQUE (user_id, period, period_key, code)
	);
	CREATE INDEX quests_user ON quests(user_id, period_key);

	CREATE TABLE collections_claimed (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		key TEXT NOT NULL,
		claimed_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, key)
	);

	CREATE TABLE chests_claimed (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		week_key TEXT NOT NULL,
		tier TEXT NOT NULL,
		claimed_at INTEGER NOT NULL,
		PRIMARY KEY (user_id, week_key)
	);

	CREATE TABLE push_subscriptions (
		endpoint TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		keys TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	`
];

export function migrate(db: Database.Database) {
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	const current = db.pragma('user_version', { simple: true }) as number;
	for (let i = current; i < MIGRATIONS.length; i++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[i]);
			db.pragma(`user_version = ${i + 1}`);
		})();
	}
}
