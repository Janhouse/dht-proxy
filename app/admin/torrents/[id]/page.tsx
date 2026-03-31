import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeleteTorrentButton } from "@/components/delete-torrent-button";
import { PeerList } from "@/components/peer-list";
import { RecrawlButton } from "@/components/recrawl-button";
import { LiveStats } from "@/components/torrent-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getIpCityInfo } from "@/lib/geoip";
import { RIGA_COORDS } from "@/lib/geoip-utils";
import { getTorrentById } from "@/lib/torrent/torrent-service";
import { extractUserIp, formatBytes } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TorrentDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const torrent = await getTorrentById(id);

	if (!torrent) {
		notFound();
	}

	const hdrs = await headers();
	const userGeo = await getIpCityInfo(extractUserIp(hdrs) ?? undefined);
	const userLat = userGeo?.lat ?? RIGA_COORDS.lat;
	const userLon = userGeo?.lon ?? RIGA_COORDS.lon;

	const metadata = torrent.metadata as {
		files?: Array<{ name: string; path: string; length: number }>;
	} | null;

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<h1 className="text-xl sm:text-2xl font-bold break-all min-w-0">
					{torrent.name || "Unnamed Torrent"}
				</h1>
				<div className="flex items-center gap-2 shrink-0">
					<RecrawlButton torrentId={torrent.id} />
					<DeleteTorrentButton
						torrentId={torrent.id}
						torrentName={torrent.name || torrent.infoHash}
						redirectTo="/admin/torrents"
					/>
				</div>
			</div>

			<LiveStats
				torrentId={torrent.id}
				initialPeerCount={torrent.peerCount}
				initialSeeders={torrent.seeders}
				initialLeechers={torrent.leechers}
				initialCrawlStatus={torrent.crawlStatus}
			/>

			<div className="grid gap-4 lg:grid-cols-2 min-w-0">
				<Card className="min-w-0 overflow-hidden">
					<CardHeader>
						<CardTitle className="text-sm font-medium">Info</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm min-w-0">
						<div>
							<span className="text-muted-foreground">Info Hash:</span>
							<p className="font-mono break-all">{torrent.infoHash}</p>
						</div>
						{torrent.magnetUri && (
							<div>
								<span className="text-muted-foreground">Magnet URI:</span>
								<p className="font-mono break-all text-xs">
									{torrent.magnetUri}
								</p>
							</div>
						)}
						<div>
							<span className="text-muted-foreground">Created:</span>{" "}
							{torrent.createdAt.toLocaleString()}
						</div>
						<div>
							<span className="text-muted-foreground">Expires:</span>{" "}
							{torrent.expiresAt.toLocaleString()}
						</div>
						<div>
							<span className="text-muted-foreground">Last Query:</span>{" "}
							{torrent.lastQueryAt
								? torrent.lastQueryAt.toLocaleString()
								: "Never"}
						</div>
						<div>
							<span className="text-muted-foreground">Last Announce:</span>{" "}
							{torrent.lastAnnounceAt
								? torrent.lastAnnounceAt.toLocaleString()
								: "Never"}
						</div>
					</CardContent>
				</Card>

				<Card className="min-w-0 overflow-hidden">
					<CardHeader>
						<CardTitle className="text-sm font-medium">
							Original Announce URLs
						</CardTitle>
					</CardHeader>
					<CardContent>
						{torrent.originalAnnounceUrls.length === 0 ? (
							<p className="text-sm text-muted-foreground">None</p>
						) : (
							<ul className="space-y-1 text-xs font-mono">
								{torrent.originalAnnounceUrls.map((url) => (
									<li key={url} className="break-all">
										{url}
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>

			{metadata?.files && metadata.files.length > 0 && (
				<Card className="overflow-hidden">
					<CardHeader>
						<CardTitle className="text-sm font-medium">Files</CardTitle>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Path</TableHead>
									<TableHead className="text-right">Size</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{metadata.files.map((file) => (
									<TableRow key={file.path}>
										<TableCell className="font-mono text-xs">
											{file.name}
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">
											{file.path}
										</TableCell>
										<TableCell className="text-right text-xs">
											{formatBytes(file.length)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			<Card className="overflow-hidden">
				<CardHeader>
					<CardTitle className="text-sm font-medium">
						Discovered Peers ({torrent.peerCount})
					</CardTitle>
				</CardHeader>
				<CardContent>
					<PeerList
						torrentId={torrent.id}
						userLat={userLat}
						userLon={userLon}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
