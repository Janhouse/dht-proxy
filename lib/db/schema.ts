import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// Enums
export const peerSourceEnum = pgEnum("peer_source", ["dht", "tracker"]);

// Torrents table
export const torrents = pgTable(
	"torrents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		infoHash: varchar("info_hash", { length: 40 }).notNull().unique(),
		name: text("name"),
		magnetUri: text("magnet_uri"),
		originalAnnounceUrls: text("original_announce_urls")
			.array()
			.notNull()
			.default([]),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		lastQueryAt: timestamp("last_query_at"),
		expiresAt: timestamp("expires_at").notNull(),
		peerCount: integer("peer_count").notNull().default(0),
		seeders: integer("seeders").notNull().default(0),
		leechers: integer("leechers").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		crawlStatus: varchar("crawl_status", { length: 20 })
			.notNull()
			.default("active"),
		lastAnnounceAt: timestamp("last_announce_at"),
		metadata: jsonb("metadata"),
	},
	(table) => [
		index("torrents_info_hash_idx").on(table.infoHash),
		index("torrents_expires_at_idx").on(table.expiresAt),
		index("torrents_is_active_idx").on(table.isActive),
	],
);

// Peers table
export const peers = pgTable(
	"peers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		torrentId: uuid("torrent_id")
			.notNull()
			.references(() => torrents.id, { onDelete: "cascade" }),
		ip: varchar("ip", { length: 45 }).notNull(),
		port: integer("port").notNull(),
		source: peerSourceEnum("source").notNull(),
		countryCode: varchar("country_code", { length: 2 }),
		countryName: varchar("country_name", { length: 100 }),
		lat: doublePrecision("lat"),
		lon: doublePrecision("lon"),
		discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
		lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
	},
	(table) => [
		index("peers_torrent_id_idx").on(table.torrentId),
		unique("peers_torrent_ip_port_unique").on(
			table.torrentId,
			table.ip,
			table.port,
		),
	],
);

// Settings table
export const settings = pgTable("settings", {
	key: varchar("key", { length: 255 }).primaryKey(),
	value: text("value").notNull(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Auth tables - managed by better-auth, but we define them for drizzle awareness
export const users = pgTable("users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
});
