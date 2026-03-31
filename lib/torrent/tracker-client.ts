import { randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import bencode from "bencode";

const TRACKER_TIMEOUT_MS = 15_000;
const PEER_ID = `-DH0001-${randomBytes(6).toString("hex")}`;
const MAX_CONCURRENT_TRACKER_REQUESTS = 16;

export interface TrackerResult {
	peers: Array<{ ip: string; port: number }>;
	complete: number;
	incomplete: number;
}

// Global concurrency pool for tracker requests across all torrents
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
	if (activeRequests < MAX_CONCURRENT_TRACKER_REQUESTS) {
		activeRequests++;
		return;
	}
	return new Promise<void>((resolve) => {
		waitQueue.push(() => {
			activeRequests++;
			resolve();
		});
	});
}

function releaseSlot(): void {
	activeRequests--;
	const next = waitQueue.shift();
	if (next) next();
}

const PRIVATE_IP_RANGES = [
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^169\.254\./,
	/^0\./,
	/^::1$/,
	/^fc00:/,
	/^fe80:/,
];

function isPrivateIp(ip: string): boolean {
	return PRIVATE_IP_RANGES.some((r) => r.test(ip));
}

/**
 * Resolve a tracker URL and check for SSRF.
 * Returns the URL rewritten to use the resolved IP (pinned) with a Host header,
 * or null if the URL targets a private/internal IP.
 * This prevents DNS rebinding attacks by resolving DNS once and using the result directly.
 */
async function resolveTrackerUrl(
	url: string,
): Promise<{ resolvedUrl: string; host: string } | null> {
	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname;

		if (isIP(hostname)) {
			if (isPrivateIp(hostname)) return null;
			return { resolvedUrl: url, host: hostname };
		}

		// Resolve hostname and pin the IP to prevent DNS rebinding
		const { address } = await lookup(hostname);
		if (isPrivateIp(address)) return null;

		// Rewrite URL to use resolved IP, preserve original host for Host header
		const originalHost = parsed.host; // includes port if present
		parsed.hostname = address;
		return { resolvedUrl: parsed.toString(), host: originalHost };
	} catch {
		return null;
	}
}

/**
 * Build the URL for HTTP tracker requests with binary info_hash.
 */
function buildTrackerUrl(
	announceUrl: string,
	infoHash: string,
	params: URLSearchParams,
): string {
	const infoHashBinary = hexToUrlEncodedBinary(infoHash);
	const separator = announceUrl.includes("?") ? "&" : "?";
	return `${announceUrl}${separator}info_hash=${infoHashBinary}&${params.toString()}`;
}

/**
 * Send an HTTP tracker announce request.
 */
async function httpTrackerAnnounce(
	announceUrl: string,
	infoHash: string,
	event: "started" | "stopped",
	numwant = 200,
): Promise<Uint8Array | null> {
	try {
		const resolved = await resolveTrackerUrl(announceUrl);
		if (!resolved) return null;

		const params = new URLSearchParams({
			peer_id: PEER_ID,
			port: "6881",
			uploaded: "0",
			downloaded: "0",
			left: "1",
			compact: "1",
			numwant: String(numwant),
			event,
		});

		const url = buildTrackerUrl(resolved.resolvedUrl, infoHash, params);

		const response = await fetch(url, {
			signal: AbortSignal.timeout(TRACKER_TIMEOUT_MS),
			headers: { "User-Agent": "DHT-Proxy/1.0", Host: resolved.host },
		});

		if (!response.ok) return null;

		const contentType = response.headers.get("content-type") || "";
		if (
			contentType.includes("text/html") ||
			contentType.includes("application/json")
		) {
			return null;
		}

		const buffer = new Uint8Array(await response.arrayBuffer());
		if (buffer.length === 0 || buffer[0] !== 0x64) return null;

		return buffer;
	} catch {
		return null;
	}
}

/**
 * Query a UDP tracker for peers.
 * Implements the UDP tracker protocol (BEP 15).
 */
async function udpTrackerQuery(
	announceUrl: string,
	infoHash: string,
): Promise<TrackerResult> {
	const empty: TrackerResult = { peers: [], complete: 0, incomplete: 0 };

	try {
		const resolved = await resolveTrackerUrl(announceUrl);
		if (!resolved) return empty;

		const url = new URL(resolved.resolvedUrl);
		const host = url.hostname;
		const port = Number.parseInt(url.port, 10) || 80;

		return await new Promise<TrackerResult>((resolve) => {
			const socket = createSocket("udp4");
			const timeout = setTimeout(() => {
				socket.close();
				resolve(empty);
			}, TRACKER_TIMEOUT_MS);

			// Step 1: Connect
			const transactionId = randomBytes(4);
			const connectBuf = Buffer.alloc(16);
			// Connection ID (magic constant for connect): 0x0000041727101980
			connectBuf.writeUInt32BE(0x00000417, 0);
			connectBuf.writeUInt32BE(0x27101980, 4);
			// Action: connect (0)
			connectBuf.writeUInt32BE(0, 8);
			// Transaction ID
			transactionId.copy(connectBuf, 12);

			socket.send(connectBuf, port, host);

			let connectionId: Buffer;

			socket.on("message", (msg) => {
				if (msg.length < 8) return;
				const action = msg.readUInt32BE(0);
				const rxTxId = msg.subarray(4, 8);

				if (action === 0 && rxTxId.equals(transactionId) && msg.length >= 16) {
					// Connect response
					connectionId = Buffer.from(msg.subarray(8, 16));

					// Step 2: Announce
					const announceBuf = Buffer.alloc(98);
					connectionId.copy(announceBuf, 0);
					// Action: announce (1)
					announceBuf.writeUInt32BE(1, 8);
					// Transaction ID
					transactionId.copy(announceBuf, 12);
					// Info hash
					Buffer.from(infoHash, "hex").copy(announceBuf, 16);
					// Peer ID
					Buffer.from(PEER_ID).copy(announceBuf, 36);
					// Downloaded, left, uploaded
					// Downloaded (8 bytes = 0)
					announceBuf.writeUInt32BE(0, 56);
					announceBuf.writeUInt32BE(0, 60);
					// Left (8 bytes = 1)
					announceBuf.writeUInt32BE(0, 64);
					announceBuf.writeUInt32BE(1, 68);
					// Uploaded (8 bytes = 0)
					announceBuf.writeUInt32BE(0, 72);
					announceBuf.writeUInt32BE(0, 76);
					// Event: 0 = none
					announceBuf.writeUInt32BE(0, 80);
					// IP address: 0 = default
					announceBuf.writeUInt32BE(0, 84);
					// Key
					randomBytes(4).copy(announceBuf, 88);
					// Num want
					announceBuf.writeInt32BE(200, 92);
					// Port
					announceBuf.writeUInt16BE(6881, 96);

					socket.send(announceBuf, port, host);
				} else if (
					action === 1 &&
					rxTxId.equals(transactionId) &&
					msg.length >= 20
				) {
					// Announce response
					clearTimeout(timeout);
					const complete = msg.readUInt32BE(16);
					const incomplete = msg.readUInt32BE(12);
					const peerData = msg.subarray(20);
					const peers = decodeCompactPeers(new Uint8Array(peerData));
					socket.close();
					resolve({ peers, complete, incomplete });
				}
			});

			socket.on("error", () => {
				clearTimeout(timeout);
				socket.close();
				resolve(empty);
			});
		});
	} catch {
		return empty;
	}
}

/**
 * Query an HTTP tracker and return discovered peers + stats.
 * Sends event=started, then event=stopped to deregister.
 */
export async function queryHttpTracker(
	announceUrl: string,
	infoHash: string,
): Promise<TrackerResult> {
	const empty: TrackerResult = { peers: [], complete: 0, incomplete: 0 };

	const buffer = await httpTrackerAnnounce(announceUrl, infoHash, "started");
	if (!buffer) return empty;

	const result = parseCompactTrackerResponse(buffer);

	// Deregister (fire and forget)
	httpTrackerAnnounce(announceUrl, infoHash, "stopped", 0).catch(() => {});

	return result;
}

/**
 * Query a single tracker (HTTP or UDP) with concurrency pool.
 */
async function queryTracker(
	announceUrl: string,
	infoHash: string,
): Promise<TrackerResult> {
	await acquireSlot();
	try {
		if (announceUrl.startsWith("udp://")) {
			return await udpTrackerQuery(announceUrl, infoHash);
		}
		return await queryHttpTracker(announceUrl, infoHash);
	} finally {
		releaseSlot();
	}
}

/**
 * Parse a bencoded tracker response and extract compact peers + stats.
 */
export function parseCompactTrackerResponse(buffer: Uint8Array): TrackerResult {
	const empty: TrackerResult = { peers: [], complete: 0, incomplete: 0 };

	try {
		const decoded = bencode.decode(buffer) as Record<string, unknown>;

		if (decoded["failure reason"]) {
			const reason = decoded["failure reason"];
			console.warn(
				`[Tracker] Failure: ${typeof reason === "object" ? new TextDecoder().decode(reason as Uint8Array) : reason}`,
			);
			return empty;
		}

		const complete = Number(decoded.complete) || 0;
		const incomplete = Number(decoded.incomplete) || 0;

		const peersData = decoded.peers;
		if (!peersData) return { peers: [], complete, incomplete };

		let peers: Array<{ ip: string; port: number }> = [];

		if (peersData instanceof Uint8Array || Buffer.isBuffer(peersData)) {
			peers = decodeCompactPeers(
				peersData instanceof Uint8Array ? peersData : new Uint8Array(peersData),
			);
		} else if (Array.isArray(peersData)) {
			const decoder = new TextDecoder();
			peers = (peersData as Array<Record<string, unknown>>)
				.map((p) => ({
					ip:
						typeof p.ip === "string"
							? p.ip
							: p.ip instanceof Uint8Array
								? decoder.decode(p.ip)
								: "",
					port: typeof p.port === "number" ? p.port : Number(p.port) || 0,
				}))
				.filter(
					(p) => p.ip && p.port > 0 && p.port <= 65535 && !isPrivateIp(p.ip),
				);
		}

		return { peers, complete, incomplete };
	} catch (err) {
		console.warn("[Tracker] Failed to parse response:", err);
		return empty;
	}
}

/**
 * Decode compact peer format: 6 bytes per peer (4 IP + 2 port).
 */
export function decodeCompactPeers(
	data: Uint8Array,
): Array<{ ip: string; port: number }> {
	const peers: Array<{ ip: string; port: number }> = [];

	for (let i = 0; i + 5 < data.length; i += 6) {
		const ip = `${data[i]}.${data[i + 1]}.${data[i + 2]}.${data[i + 3]}`;
		const port = (data[i + 4] << 8) | data[i + 5];

		if (port > 0 && port <= 65535 && ip !== "0.0.0.0" && !isPrivateIp(ip)) {
			peers.push({ ip, port });
		}
	}

	return peers;
}

/**
 * Query all original announce URLs for a torrent.
 * HTTP and UDP trackers run in parallel, throttled by global pool (max 16 concurrent).
 */
export async function queryAllTrackers(
	announceUrls: string[],
	infoHash: string,
): Promise<TrackerResult> {
	const allPeers: Array<{ ip: string; port: number }> = [];
	const seen = new Set<string>();
	let totalComplete = 0;
	let totalIncomplete = 0;

	const supportedUrls = announceUrls.filter(
		(url) => url.startsWith("http") || url.startsWith("udp://"),
	);

	const results = await Promise.allSettled(
		supportedUrls.map((url) => queryTracker(url, infoHash)),
	);

	for (const result of results) {
		if (result.status === "fulfilled") {
			const { peers, complete, incomplete } = result.value;
			totalComplete = Math.max(totalComplete, complete);
			totalIncomplete = Math.max(totalIncomplete, incomplete);
			for (const peer of peers) {
				const key = `${peer.ip}:${peer.port}`;
				if (!seen.has(key)) {
					seen.add(key);
					allPeers.push(peer);
				}
			}
		}
	}

	return {
		peers: allPeers,
		complete: totalComplete,
		incomplete: totalIncomplete,
	};
}

function hexToUrlEncodedBinary(hex: string): string {
	let result = "";
	for (let i = 0; i < hex.length; i += 2) {
		const byte = Number.parseInt(hex.substring(i, i + 2), 16);
		result += `%${byte.toString(16).padStart(2, "0").toUpperCase()}`;
	}
	return result;
}
