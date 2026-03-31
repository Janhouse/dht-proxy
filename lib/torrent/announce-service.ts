import { isIP } from "node:net";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { peers, torrents } from "../db/schema";
import { getIpCityInfo } from "../geoip";

const DEFAULT_NUMWANT = 50;
const MAX_NUMWANT = 200;
// Approximate degrees for 1000km at mid-latitudes
const CLOSE_DISTANCE_DEG = 9;

/**
 * Resolve info_hash from request URL params.
 * Handles hex-encoded (our custom param) and mangled binary (BT standard).
 */
export async function resolveInfoHash(
	searchParams: URLSearchParams,
): Promise<string | null> {
	// Preferred: our custom hex-encoded param
	const hexHash = searchParams.get("info_hash_hex");
	if (hexHash && hexHash.length === 40 && /^[0-9a-fA-F]+$/.test(hexHash)) {
		return hexHash.toLowerCase();
	}

	// Fallback: recover from UTF-8 mangled binary info_hash
	const rawInfoHash = searchParams.get("info_hash");
	if (!rawInfoHash) return null;

	const partialHex: string[] = [];
	for (let i = 0; i < rawInfoHash.length; i++) {
		const code = rawInfoHash.charCodeAt(i);
		if (code === 0xfffd) {
			partialHex.push("__");
		} else if (code < 128) {
			partialHex.push(code.toString(16).padStart(2, "0"));
		} else {
			partialHex.push("__");
		}
	}

	if (partialHex.length >= 15) {
		const likePattern = partialHex.map((b) => (b === "__" ? "_" : b)).join("");
		if (likePattern.length >= 30) {
			const results = await db
				.select({ infoHash: torrents.infoHash })
				.from(torrents)
				.where(eq(torrents.isActive, true))
				.limit(100);

			for (const row of results) {
				let match = true;
				for (
					let i = 0;
					i < partialHex.length && i * 2 + 1 < row.infoHash.length;
					i++
				) {
					if (partialHex[i] !== "__") {
						const dbByte = row.infoHash.substring(i * 2, i * 2 + 2);
						if (dbByte !== partialHex[i]) {
							match = false;
							break;
						}
					}
				}
				if (match) return row.infoHash;
			}
		}
	}

	return null;
}

export interface AnnounceParams {
	numwant: number;
	clientIp: string | null;
}

/**
 * Parse announce request parameters.
 */
export function parseAnnounceParams(
	searchParams: URLSearchParams,
): AnnounceParams {
	const numwant = Math.min(
		Math.max(
			Number.parseInt(searchParams.get("numwant") || "", 10) || DEFAULT_NUMWANT,
			1,
		),
		MAX_NUMWANT,
	);
	const rawIp = searchParams.get("ipv4") || searchParams.get("ip") || null;
	const clientIp = rawIp && isIP(rawIp) ? rawIp : null;
	return { numwant, clientIp };
}

/**
 * Select peers for an announcing client, preferring geo-close peers.
 */
export async function selectPeersForClient(
	torrentId: string,
	numwant: number,
	clientIp: string | null,
): Promise<Array<{ ip: string; port: number }>> {
	const clientGeo = await getIpCityInfo(clientIp ?? undefined);

	if (!clientGeo?.lat || !clientGeo?.lon) {
		return db
			.select({ ip: peers.ip, port: peers.port })
			.from(peers)
			.where(eq(peers.torrentId, torrentId))
			.orderBy(sql`RANDOM()`)
			.limit(numwant);
	}

	const { lat, lon } = clientGeo;

	// Get close peers (within ~1000km)
	const closePeers = await db
		.select({ ip: peers.ip, port: peers.port })
		.from(peers)
		.where(
			sql`${peers.torrentId} = ${torrentId}
				AND ${peers.lat} IS NOT NULL
				AND ${peers.lon} IS NOT NULL
				AND ABS(${peers.lat} - ${lat}) < ${CLOSE_DISTANCE_DEG}
				AND ABS(${peers.lon} - ${lon}) < ${CLOSE_DISTANCE_DEG * 1.5}`,
		)
		.orderBy(sql`RANDOM()`)
		.limit(numwant);

	if (closePeers.length >= numwant) {
		return closePeers;
	}

	// Fill with random others
	const closeIps = new Set(closePeers.map((p) => `${p.ip}:${p.port}`));
	const remaining = numwant - closePeers.length;

	const otherPeers = await db
		.select({ ip: peers.ip, port: peers.port })
		.from(peers)
		.where(eq(peers.torrentId, torrentId))
		.orderBy(sql`RANDOM()`)
		.limit(remaining + closePeers.length);

	const fillers = otherPeers.filter((p) => !closeIps.has(`${p.ip}:${p.port}`));

	return [...closePeers, ...fillers.slice(0, remaining)];
}
