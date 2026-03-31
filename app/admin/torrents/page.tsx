import { TorrentListLive } from "@/components/torrent-list-live";
import { Badge } from "@/components/ui/badge";
import { listTorrents } from "@/lib/torrent/torrent-service";

export const dynamic = "force-dynamic";

export default async function TorrentsPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string }>;
}) {
	const params = await searchParams;
	const page = Number.parseInt(params.page || "1", 10) || 1;
	const { torrents: allTorrents, total, hasMore } = await listTorrents(page);

	const initialData = allTorrents.map((t) => ({
		id: t.id,
		infoHash: t.infoHash,
		name: t.name,
		peerCount: t.peerCount,
		seeders: t.seeders,
		leechers: t.leechers,
		crawlStatus: t.crawlStatus,
		lastAnnounceAt: t.lastAnnounceAt?.toISOString() ?? null,
		lastQueryAt: t.lastQueryAt?.toISOString() ?? null,
		expiresAt: t.expiresAt.toLocaleDateString(),
		isActive: t.isActive,
	}));

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Torrents</h1>
				<Badge variant="outline">{total} total</Badge>
			</div>

			<TorrentListLive
				initialData={initialData}
				total={total}
				page={page}
				hasMore={hasMore}
			/>
		</div>
	);
}
