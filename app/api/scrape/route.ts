export const runtime = "nodejs";

import bencode from "bencode";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveInfoHash } from "@/lib/torrent/announce-service";
import { getTorrentByInfoHash } from "@/lib/torrent/torrent-service";
import { extractUserIp } from "@/lib/utils";

/**
 * BitTorrent HTTP tracker scrape endpoint.
 */
export async function GET(request: NextRequest): Promise<Response> {
	// Rate limit: 60 requests per minute per IP
	const reqIp = extractUserIp(request.headers) || "unknown";
	const rl = rateLimit(`scrape:${reqIp}`, 60, 60_000);
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
			Buffer.from(bencode.encode({ "failure reason": "missing info_hash" })),
			{ headers: { "Content-Type": "text/plain" } },
		);
	}

	const torrent = await getTorrentByInfoHash(infoHash);

	const hexToBuffer = (hex: string): Uint8Array => {
		const bytes = new Uint8Array(hex.length / 2);
		for (let i = 0; i < hex.length; i += 2) {
			bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
		}
		return bytes;
	};

	const files: Record<string, unknown> = {};
	const key = hexToBuffer(infoHash);
	files[String.fromCharCode(...key)] = {
		complete: 0,
		downloaded: 0,
		incomplete: torrent?.peerCount ?? 0,
	};

	return new Response(Buffer.from(bencode.encode({ files })), {
		headers: { "Content-Type": "text/plain" },
	});
}
