export const runtime = "nodejs";

import bencode from "bencode";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
	parseAnnounceParams,
	resolveInfoHash,
	selectPeersForClient,
} from "@/lib/torrent/announce-service";
import {
	isCrawling,
	startCrawlLock,
	waitForCrawl,
} from "@/lib/torrent/crawl-lock";
import {
	discoverPeers,
	getTorrentByInfoHash,
	resumeTorrentCrawl,
	updateLastAnnounce,
} from "@/lib/torrent/torrent-service";
import { buildAnnounceResponse } from "@/lib/torrent/torrent-utils";
import { extractUserIp } from "@/lib/utils";

/**
 * BitTorrent HTTP tracker announce endpoint.
 * - Tracks lastAnnounceAt for activity-based pause/resume
 * - Resumes paused torrents with a crawl lock
 * - Waits for initial crawl on freshly added/resumed torrents
 */
export async function GET(request: NextRequest): Promise<Response> {
	// Rate limit: 120 requests per minute per IP
	const reqIp = extractUserIp(request.headers) || "unknown";
	const rl = rateLimit(`announce:${reqIp}`, 120, 60_000);
	if (!rl.allowed) {
		return new Response(
			Buffer.from(bencode.encode({ "failure reason": "rate limit exceeded" })),
			{ status: 429, headers: { "Content-Type": "text/plain" } },
		);
	}

	const params = new URL(request.url).searchParams;
	const infoHash = await resolveInfoHash(params);

	if (!infoHash) {
		return new Response(
			Buffer.from(
				bencode.encode({ "failure reason": "missing or invalid info_hash" }),
			),
			{ status: 400, headers: { "Content-Type": "text/plain" } },
		);
	}

	const torrent = await getTorrentByInfoHash(infoHash);

	if (!torrent) {
		return new Response(Buffer.from(buildAnnounceResponse([])), {
			headers: { "Content-Type": "text/plain" },
		});
	}

	// Track announce activity (fire-and-forget)
	updateLastAnnounce(torrent.id);

	// Resume paused torrents with a crawl lock
	if (torrent.crawlStatus === "paused") {
		console.log(
			`[Announce] Resuming paused torrent ${infoHash}, starting crawl with lock`,
		);
		await resumeTorrentCrawl(torrent.id);

		const releaseLock = startCrawlLock(infoHash);
		discoverPeers(torrent.id, infoHash, torrent.originalAnnounceUrls)
			.catch(console.error)
			.finally(releaseLock);
	}

	// Wait for crawl if no peers yet (fresh add or resume)
	if (torrent.peerCount === 0 || torrent.crawlStatus === "paused") {
		if (isCrawling(infoHash)) {
			console.log(`[Announce] Waiting for crawl to finish for ${infoHash}`);
			const start = Date.now();
			await waitForCrawl(infoHash);
			console.log(
				`[Announce] Crawl lock released for ${infoHash} after ${Date.now() - start}ms`,
			);
		} else {
			console.log(`[Announce] No peers and no active crawl for ${infoHash}`);
		}
	}

	const { numwant, clientIp } = parseAnnounceParams(params);
	const peerList = await selectPeersForClient(torrent.id, numwant, clientIp);
	console.log(
		`[Announce] Returning ${peerList.length} peers for ${infoHash} (numwant=${numwant})`,
	);

	return new Response(Buffer.from(buildAnnounceResponse(peerList)), {
		headers: { "Content-Type": "text/plain" },
	});
}
