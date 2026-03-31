import { count, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { settings, torrents } from "../db/schema";
import { startCrawlLock } from "./crawl-lock";
import { lookupPeers, storePeers } from "./dht-crawler";
import {
	buildMagnetUri,
	createPrivateTorrent,
	parseMagnetOrTorrent,
} from "./torrent-utils";
import { queryAllTrackers } from "./tracker-client";

const DEFAULT_TTL_DAYS = 7;

export async function getTtlDays(): Promise<number> {
	const row = await db
		.select()
		.from(settings)
		.where(eq(settings.key, "ttl_days"))
		.then((rows) => rows[0]);
	return row
		? Number.parseInt(row.value, 10) || DEFAULT_TTL_DAYS
		: DEFAULT_TTL_DAYS;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export async function listTorrents(page = 1, limit = DEFAULT_LIST_LIMIT) {
	const safeLimit = Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
	const safePage = Math.max(page, 1);
	const offset = (safePage - 1) * safeLimit;

	const [items, [{ total }]] = await Promise.all([
		db
			.select()
			.from(torrents)
			.orderBy(desc(torrents.createdAt))
			.limit(safeLimit)
			.offset(offset),
		db.select({ total: count() }).from(torrents),
	]);

	return {
		torrents: items,
		total,
		page: safePage,
		limit: safeLimit,
		hasMore: offset + safeLimit < total,
	};
}

export async function getTorrentById(id: string) {
	return db
		.select()
		.from(torrents)
		.where(eq(torrents.id, id))
		.then((rows) => rows[0] ?? null);
}

export async function getTorrentByInfoHash(infoHash: string) {
	return db
		.select()
		.from(torrents)
		.where(eq(torrents.infoHash, infoHash))
		.then((rows) => rows[0] ?? null);
}

export async function updateLastAnnounce(torrentId: string): Promise<void> {
	db.update(torrents)
		.set({ lastAnnounceAt: new Date() })
		.where(eq(torrents.id, torrentId))
		.catch(console.error);
}

export async function resumeTorrentCrawl(torrentId: string): Promise<void> {
	await db
		.update(torrents)
		.set({ crawlStatus: "active" })
		.where(eq(torrents.id, torrentId));
}

export async function getTorrentStatuses() {
	return db
		.select({
			id: torrents.id,
			infoHash: torrents.infoHash,
			crawlStatus: torrents.crawlStatus,
			lastAnnounceAt: torrents.lastAnnounceAt,
			lastQueryAt: torrents.lastQueryAt,
			peerCount: torrents.peerCount,
			seeders: torrents.seeders,
			leechers: torrents.leechers,
		})
		.from(torrents)
		.where(eq(torrents.isActive, true));
}

export async function deleteTorrent(id: string) {
	return db
		.delete(torrents)
		.where(eq(torrents.id, id))
		.returning({ id: torrents.id });
}

/**
 * Create or refresh a torrent from a magnet URI or .torrent file buffer.
 * Returns the generated private .torrent file buffer.
 */
export async function addTorrent(input: string | Uint8Array): Promise<{
	torrentId: string;
	infoHash: string;
	torrentFile: Uint8Array | null;
	magnetUri: string | null;
}> {
	const parsed = await parseMagnetOrTorrent(input);
	const ttlDays = await getTtlDays();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

	const existing = await getTorrentByInfoHash(parsed.infoHash);
	let torrentId: string;

	if (existing) {
		await db
			.update(torrents)
			.set({
				expiresAt,
				isActive: true,
				updatedAt: now,
				...(parsed.name && !existing.name ? { name: parsed.name } : {}),
			})
			.where(eq(torrents.id, existing.id));
		torrentId = existing.id;
	} else {
		const [inserted] = await db
			.insert(torrents)
			.values({
				infoHash: parsed.infoHash,
				name: parsed.name,
				magnetUri: typeof input === "string" ? input : null,
				originalAnnounceUrls: parsed.announce,
				expiresAt,
				metadata: parsed.files.length > 0 ? { files: parsed.files } : null,
			})
			.returning({ id: torrents.id });
		torrentId = inserted.id;
	}

	const announceUrl =
		process.env.ANNOUNCE_URL || "http://localhost:3000/api/announce";
	const separator = announceUrl.includes("?") ? "&" : "?";
	const fullAnnounceUrl = `${announceUrl}${separator}info_hash_hex=${parsed.infoHash}`;

	// If we have full metadata, return a .torrent file; otherwise return a magnet URI
	const hasTorrentData = !!parsed.infoBuffer;
	const torrentFile = hasTorrentData
		? createPrivateTorrent(parsed, announceUrl)
		: null;
	const magnetUri = hasTorrentData
		? null
		: buildMagnetUri(parsed.infoHash, parsed.name, fullAnnounceUrl);

	// Start background peer discovery with a crawl lock.
	// The announce endpoint will wait on this lock before returning empty peers.
	console.log(
		`[Add] Torrent added: ${parsed.infoHash} (${parsed.name || "unnamed"}), starting crawl with lock`,
	);
	const releaseLock = startCrawlLock(parsed.infoHash);
	discoverPeers(torrentId, parsed.infoHash, parsed.announce)
		.then((result) => {
			console.log(
				`[Add] Crawl complete for ${parsed.infoHash}: ${result.dhtPeers} DHT peers, seeders=${result.seeders}, leechers=${result.leechers}`,
			);
		})
		.catch(console.error)
		.finally(releaseLock);

	return { torrentId, torrentFile, magnetUri, infoHash: parsed.infoHash };
}

/**
 * Discover peers for a torrent via DHT and trackers.
 * Used by both /api/add background job and /api/torrents/[id]/recrawl.
 */
export async function discoverPeers(
	torrentId: string,
	infoHash: string,
	announceUrls: string[],
): Promise<{ dhtPeers: number; seeders: number; leechers: number }> {
	console.log(
		`[Discover] Starting DHT + tracker discovery in parallel for ${infoHash} (${announceUrls.length} trackers)`,
	);

	// Run DHT lookup and tracker queries in parallel
	const [dhtPeers, trackerResult] = await Promise.all([
		lookupPeers(infoHash),
		announceUrls.length > 0
			? queryAllTrackers(announceUrls, infoHash)
			: Promise.resolve({ peers: [], complete: 0, incomplete: 0 }),
	]);

	console.log(
		`[Discover] ${infoHash}: DHT found ${dhtPeers.length}, trackers found ${trackerResult.peers.length}`,
	);

	// Store peers (also in parallel)
	await Promise.all([
		dhtPeers.length > 0
			? storePeers(torrentId, dhtPeers, "dht")
			: Promise.resolve(),
		trackerResult.peers.length > 0
			? storePeers(torrentId, trackerResult.peers, "tracker")
			: Promise.resolve(),
	]);

	const seeders = trackerResult.complete;
	const leechers = trackerResult.incomplete;

	await db
		.update(torrents)
		.set({ lastQueryAt: new Date(), seeders, leechers })
		.where(eq(torrents.id, torrentId));

	return { dhtPeers: dhtPeers.length, seeders, leechers };
}
