import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { isCrawling } from "@/lib/torrent/crawl-lock";
import { getTorrentStatuses } from "@/lib/torrent/torrent-service";

const PAUSE_AFTER_MS = 15 * 60 * 1000;

export async function GET(): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}

	const rows = await getTorrentStatuses();

	const statuses = rows.map((r) => ({
		...r,
		isCrawling: isCrawling(r.infoHash),
		pausesAt:
			r.crawlStatus === "active" && r.lastAnnounceAt
				? new Date(r.lastAnnounceAt.getTime() + PAUSE_AFTER_MS).toISOString()
				: null,
	}));

	return NextResponse.json(statuses);
}
