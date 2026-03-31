export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { discoverPeers, getTorrentById } from "@/lib/torrent/torrent-service";

export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}

	const { id } = await params;
	const torrent = await getTorrentById(id);

	if (!torrent) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const result = await discoverPeers(
		torrent.id,
		torrent.infoHash,
		torrent.originalAnnounceUrls,
	);

	return NextResponse.json({ success: true, ...result });
}
