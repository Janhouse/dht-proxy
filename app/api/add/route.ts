export const runtime = "nodejs";

import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { addTorrent } from "@/lib/torrent/torrent-service";
import { extractUserIp } from "@/lib/utils";

function isValidBearerToken(
	authHeader: string | null,
	expectedToken: string,
): boolean {
	if (!authHeader) return false;
	const expected = `Bearer ${expectedToken}`;
	if (authHeader.length !== expected.length) return false;
	return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/**
 * POST /api/add — accept magnet/torrent, return private .torrent file or magnet URI.
 * When DHT_PROXY_PUBLIC=false, requires either:
 *   - A valid session (cookie-based, for browser UI)
 *   - Authorization: Bearer <token> (for API/automation)
 */
export async function POST(request: NextRequest): Promise<Response> {
	if (process.env.DHT_PROXY_PUBLIC === "false") {
		const authHeader = request.headers.get("authorization");
		const expectedToken = process.env.DHT_PROXY_API_TOKEN;

		if (expectedToken) {
			// Token is configured — require valid bearer token or session
			const hasValidToken = isValidBearerToken(authHeader, expectedToken);
			if (!hasValidToken) {
				const session = await getSession();
				if (!session) {
					return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
				}
			}
		} else {
			// No token configured — require session auth
			const session = await getSession();
			if (!session) {
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
		}
	}

	// Rate limit: 30 requests per minute per IP
	const clientIp = extractUserIp(request.headers) || "unknown";
	const rl = rateLimit(`add:${clientIp}`, 30, 60_000);
	if (!rl.allowed) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	try {
		const contentType = request.headers.get("content-type") || "";
		let input: string | Uint8Array;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			const file = formData.get("torrent") as File | null;
			const magnet = formData.get("magnet") as string | null;

			if (file) {
				input = new Uint8Array(await file.arrayBuffer());
			} else if (magnet) {
				input = magnet;
			} else {
				return NextResponse.json(
					{ error: "Provide a 'torrent' file or 'magnet' field" },
					{ status: 400 },
				);
			}
		} else {
			const body = await request.json();
			if (!body.magnet) {
				return NextResponse.json(
					{ error: "Provide a 'magnet' field" },
					{ status: 400 },
				);
			}
			input = body.magnet;
		}

		const result = await addTorrent(input);

		if (result.torrentFile) {
			return new Response(Buffer.from(result.torrentFile), {
				headers: {
					"Content-Type": "application/x-bittorrent",
					"Content-Disposition": `attachment; filename="${result.infoHash}.torrent"`,
					"X-DHT-Proxy-Type": "torrent",
				},
			});
		}

		return NextResponse.json(
			{ magnet: result.magnetUri, infoHash: result.infoHash },
			{ headers: { "X-DHT-Proxy-Type": "magnet" } },
		);
	} catch (err) {
		console.error("[API /add] Error:", err);
		return NextResponse.json(
			{ error: "Failed to process torrent" },
			{ status: 500 },
		);
	}
}
