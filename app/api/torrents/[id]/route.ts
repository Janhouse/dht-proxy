import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { deleteTorrent, getTorrentById } from "@/lib/torrent/torrent-service";

export async function GET(
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

	return NextResponse.json(torrent);
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}

	const { id } = await params;
	const deleted = await deleteTorrent(id);

	if (deleted.length === 0) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json({ success: true });
}
