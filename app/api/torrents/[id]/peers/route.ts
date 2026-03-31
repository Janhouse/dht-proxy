export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
	getPaginatedPeers,
	parsePeerQueryParams,
} from "@/lib/torrent/peer-service";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}

	const { id } = await params;
	const queryParams = parsePeerQueryParams(request.nextUrl.searchParams);
	const result = await getPaginatedPeers(id, queryParams);

	return NextResponse.json(result);
}
