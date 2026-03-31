import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { listTorrents } from "@/lib/torrent/torrent-service";

export async function GET(request: NextRequest): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}

	const params = request.nextUrl.searchParams;
	const page = Number.parseInt(params.get("page") || "1", 10) || 1;
	const limit = Number.parseInt(params.get("limit") || "50", 10) || 50;

	return NextResponse.json(await listTorrents(page, limit));
}
