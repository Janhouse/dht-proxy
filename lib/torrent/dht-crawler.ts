import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import DHT from "bittorrent-dht";
import { and, count, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { peers, torrents } from "../db/schema";
import { getIpCityInfo } from "../geoip";
import { queryAllTrackers } from "./tracker-client";

const DHT_NODES_PATH = join(process.cwd(), "data", "dht-nodes.json");
const CRAWL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PEER_STALE_MS = 60 * 60 * 1000; // 1 hour — remove peers not seen in this window
const PAUSE_AFTER_MS = 15 * 60 * 1000; // 15 minutes without announce → pause crawling
const LOOKUP_TIMEOUT_MS = 30_000; // 30 seconds per lookup

const DHT_TEARDOWN_DELAY_MS = 5 * 60 * 1000; // 5 minutes grace before destroying idle DHT

declare global {
	var __dhtNode: DHT | undefined;
	var __dhtCrawlInterval: ReturnType<typeof setInterval> | undefined;
	var __dhtCleanupInterval: ReturnType<typeof setInterval> | undefined;
	var __dhtTeardownTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Get or create the singleton DHT node.
 * Stored in globalThis to survive Next.js HMR in dev mode.
 */
export function getDhtNode(): DHT {
	if (globalThis.__dhtNode) {
		return globalThis.__dhtNode;
	}

	const opts: Record<string, unknown> = {};

	// Load persisted routing table for fast bootstrap
	const savedNodes = loadPersistedNodes();
	if (savedNodes.length > 0) {
		opts.bootstrap = savedNodes;
	}

	const dht = new DHT(opts);
	globalThis.__dhtNode = dht;

	dht.on("error", (err: Error) => {
		console.error("[DHT] Error:", err.message);
	});

	dht.on("warning", (err: Error) => {
		console.warn("[DHT] Warning:", err.message);
	});

	dht.on("listening", () => {
		console.log("[DHT] Node listening");
	});

	return dht;
}

/**
 * Destroy the DHT node, persisting routing table first.
 */
export function destroyDhtNode(): void {
	cancelDhtTeardown();
	const dht = globalThis.__dhtNode;
	if (!dht) return;

	persistDhtNodes();
	dht.destroy();
	globalThis.__dhtNode = undefined;
	console.log("[DHT] Node destroyed (no active torrents)");
}

/**
 * Ensure the DHT node is running. Creates it if needed.
 * Call this before any operation that requires the DHT network.
 */
export function ensureDhtNode(): DHT {
	cancelDhtTeardown();
	return getDhtNode();
}

/**
 * Schedule DHT node teardown after the grace period.
 */
function scheduleDhtTeardown(): void {
	if (globalThis.__dhtTeardownTimer) return; // already scheduled
	if (!globalThis.__dhtNode) return; // nothing to tear down

	console.log(
		`[DHT] No active torrents — scheduling teardown in ${DHT_TEARDOWN_DELAY_MS / 1000}s`,
	);
	globalThis.__dhtTeardownTimer = setTimeout(() => {
		globalThis.__dhtTeardownTimer = undefined;
		destroyDhtNode();
	}, DHT_TEARDOWN_DELAY_MS);
}

/**
 * Cancel a pending DHT teardown (e.g., when a torrent is added).
 */
function cancelDhtTeardown(): void {
	if (globalThis.__dhtTeardownTimer) {
		clearTimeout(globalThis.__dhtTeardownTimer);
		globalThis.__dhtTeardownTimer = undefined;
	}
}

/**
 * Look up peers for a given infohash via DHT.
 * Returns discovered peers as an array of {ip, port}.
 */
export function lookupPeers(
	infoHash: string,
): Promise<Array<{ ip: string; port: number }>> {
	return new Promise((resolve) => {
		const dht = ensureDhtNode();
		const discovered: Array<{ ip: string; port: number }> = [];
		const seen = new Set<string>();

		const onPeer = (peer: { host: string; port: number }, hash: Buffer) => {
			const hashHex =
				typeof hash === "string" ? hash : Buffer.from(hash).toString("hex");
			if (hashHex !== infoHash.toLowerCase()) return;

			const key = `${peer.host}:${peer.port}`;
			if (!seen.has(key)) {
				seen.add(key);
				discovered.push({ ip: peer.host, port: peer.port });
			}
		};

		dht.on("peer", onPeer);

		const timeout = setTimeout(() => {
			dht.removeListener("peer", onPeer);
			resolve(discovered);
		}, LOOKUP_TIMEOUT_MS);

		dht.lookup(infoHash, () => {
			clearTimeout(timeout);
			dht.removeListener("peer", onPeer);
			resolve(discovered);
		});
	});
}

/**
 * Store discovered peers in the database.
 */
export async function storePeers(
	torrentId: string,
	discoveredPeers: Array<{ ip: string; port: number }>,
	source: "dht" | "tracker",
): Promise<void> {
	if (discoveredPeers.length === 0) return;

	const now = new Date();

	// Look up geo for unique IPs
	const uniqueIps = [...new Set(discoveredPeers.map((p) => p.ip))];
	const geoMap = new Map<string, Awaited<ReturnType<typeof getIpCityInfo>>>();
	await Promise.all(
		uniqueIps.map(async (ip) => {
			geoMap.set(ip, await getIpCityInfo(ip));
		}),
	);

	for (const peer of discoveredPeers) {
		const geo = geoMap.get(peer.ip);
		await db
			.insert(peers)
			.values({
				torrentId,
				ip: peer.ip,
				port: peer.port,
				source,
				countryCode: geo?.countryCode ?? null,
				countryName: geo?.countryName ?? null,
				lat: geo?.lat ?? null,
				lon: geo?.lon ?? null,
				discoveredAt: now,
				lastSeenAt: now,
			})
			.onConflictDoUpdate({
				target: [peers.torrentId, peers.ip, peers.port],
				set: {
					lastSeenAt: now,
					countryCode: geo?.countryCode ?? null,
					countryName: geo?.countryName ?? null,
					lat: geo?.lat ?? null,
					lon: geo?.lon ?? null,
				},
			});
	}

	// Update peer count on torrent
	const [{ peerCount }] = await db
		.select({ peerCount: count() })
		.from(peers)
		.where(eq(peers.torrentId, torrentId));

	await db
		.update(torrents)
		.set({ peerCount, updatedAt: now })
		.where(eq(torrents.id, torrentId));
}

/**
 * Remove peers not seen in the last hour for a specific torrent.
 */
export async function cleanupStalePeers(torrentId?: string): Promise<number> {
	const cutoff = new Date(Date.now() - PEER_STALE_MS);

	const condition = torrentId
		? and(eq(peers.torrentId, torrentId), lt(peers.lastSeenAt, cutoff))
		: lt(peers.lastSeenAt, cutoff);

	const deleted = await db
		.delete(peers)
		.where(condition!)
		.returning({ id: peers.id });

	return deleted.length;
}

/**
 * Crawl all active torrents: DHT lookup for each.
 */
export async function crawlAllTorrents(): Promise<void> {
	const activeTorrents = await db
		.select()
		.from(torrents)
		.where(eq(torrents.isActive, true));

	// Nothing to crawl — schedule DHT teardown after grace period
	if (activeTorrents.length === 0) {
		scheduleDhtTeardown();
		return;
	}

	// We have work to do — ensure DHT is running and cancel any pending teardown
	ensureDhtNode();
	console.log("[DHT] Starting periodic crawl...");

	for (const torrent of activeTorrents) {
		// Skip paused torrents
		if (torrent.crawlStatus === "paused") continue;

		// Auto-pause if no announce in PAUSE_AFTER_MS
		// Use lastAnnounceAt if available, otherwise use createdAt (torrent never announced for)
		const now = Date.now();
		const lastActivity =
			torrent.lastAnnounceAt?.getTime() ?? torrent.createdAt.getTime();
		if (now - lastActivity > PAUSE_AFTER_MS) {
			const label = torrent.name || torrent.infoHash;
			const reason = torrent.lastAnnounceAt
				? `no announce in ${Math.round((now - lastActivity) / 60000)}m`
				: `never announced, created ${Math.round((now - lastActivity) / 60000)}m ago`;
			console.log(`[Crawl] Pausing ${label} — ${reason}`);
			await db
				.update(torrents)
				.set({ crawlStatus: "paused" })
				.where(eq(torrents.id, torrent.id));
			continue;
		}

		try {
			const label = torrent.name || torrent.infoHash;
			console.log(`[Crawl] Looking up peers for ${label}`);

			// DHT lookup
			const discovered = await lookupPeers(torrent.infoHash);
			if (discovered.length > 0) {
				await storePeers(torrent.id, discovered, "dht");
			}

			// Tracker queries
			let seeders = 0;
			let leechers = 0;
			if (torrent.originalAnnounceUrls.length > 0) {
				const trackerResult = await queryAllTrackers(
					torrent.originalAnnounceUrls,
					torrent.infoHash,
				);
				if (trackerResult.peers.length > 0) {
					await storePeers(torrent.id, trackerResult.peers, "tracker");
				}
				seeders = trackerResult.complete;
				leechers = trackerResult.incomplete;
			}

			// Clean up stale peers for this torrent
			const staleRemoved = await cleanupStalePeers(torrent.id);

			// Update peer count
			const [{ freshCount }] = await db
				.select({ freshCount: count() })
				.from(peers)
				.where(eq(peers.torrentId, torrent.id));

			console.log(
				`[Crawl] ${label}: ${discovered.length} DHT peers, seeders=${seeders}, leechers=${leechers}, stale removed=${staleRemoved}, total=${freshCount}`,
			);

			await db
				.update(torrents)
				.set({
					lastQueryAt: new Date(),
					seeders,
					leechers,
					peerCount: freshCount,
				})
				.where(eq(torrents.id, torrent.id));
		} catch (err) {
			console.error(`[Crawl] Error crawling ${torrent.infoHash}:`, err);
		}
	}

	console.log("[DHT] Periodic crawl complete.");
}

/**
 * Remove expired torrents and their peers (cascade delete via FK).
 */
export async function cleanupExpiredTorrents(): Promise<void> {
	const now = new Date();
	const expired = await db
		.delete(torrents)
		.where(lt(torrents.expiresAt, now))
		.returning({ infoHash: torrents.infoHash });

	for (const t of expired) {
		console.log(`[Cleanup] Removed expired torrent ${t.infoHash}`);
	}

	if (expired.length > 0) {
		console.log(`[Cleanup] Removed ${expired.length} expired torrents`);
	}

	// Also clean up stale peers across all torrents
	const stalePeers = await cleanupStalePeers();
	if (stalePeers > 0) {
		console.log(`[Cleanup] Removed ${stalePeers} stale peers`);
	}
}

/**
 * Start periodic background jobs.
 */
export function startBackgroundJobs(): void {
	if (globalThis.__dhtCrawlInterval) {
		clearInterval(globalThis.__dhtCrawlInterval);
	}
	if (globalThis.__dhtCleanupInterval) {
		clearInterval(globalThis.__dhtCleanupInterval);
	}

	// Periodic crawl
	globalThis.__dhtCrawlInterval = setInterval(() => {
		crawlAllTorrents().catch(console.error);
	}, CRAWL_INTERVAL_MS);

	// Periodic cleanup
	globalThis.__dhtCleanupInterval = setInterval(() => {
		cleanupExpiredTorrents().catch(console.error);
	}, CLEANUP_INTERVAL_MS);

	console.log("[DHT] Background jobs started");
}

/**
 * Persist DHT routing table to disk for fast restart.
 */
export function persistDhtNodes(): void {
	const dht = globalThis.__dhtNode;
	if (!dht) return;

	try {
		const nodes = dht.toJSON().nodes;
		const dir = join(process.cwd(), "data");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(DHT_NODES_PATH, JSON.stringify(nodes));
		console.log(`[DHT] Persisted ${nodes.length} nodes to disk`);
	} catch (err) {
		console.error("[DHT] Failed to persist nodes:", err);
	}
}

/**
 * Load persisted DHT nodes from disk.
 */
function loadPersistedNodes(): Array<{ host: string; port: number }> {
	try {
		if (existsSync(DHT_NODES_PATH)) {
			const data = readFileSync(DHT_NODES_PATH, "utf-8");
			const nodes = JSON.parse(data);
			console.log(`[DHT] Loaded ${nodes.length} persisted nodes`);
			return nodes;
		}
	} catch (err) {
		console.warn("[DHT] Failed to load persisted nodes:", err);
	}
	return [];
}
