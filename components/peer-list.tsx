"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PeerFlag } from "@/components/peer-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { haversineDistance } from "@/lib/geoip-utils";

interface Peer {
	ip: string;
	port: number;
	sources: string[];
	countryCode: string | null;
	countryName: string | null;
	lat: number | null;
	lon: number | null;
	lastSeenAt: string;
	distanceKm: number | null;
}

const PAGE_SIZE = 50;
const LOAD_MORE_EVERY = 3; // Show "Load more" button every 3 auto-loaded pages

export function PeerList({
	torrentId,
	userLat,
	userLon,
}: {
	torrentId: string;
	userLat: number;
	userLon: number;
}) {
	const [peers, setPeers] = useState<Peer[]>([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(false);
	const [autoLoadCount, setAutoLoadCount] = useState(0);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const fetchPage = useCallback(
		async (p: number) => {
			setLoading(true);
			try {
				const res = await fetch(
					`/api/torrents/${torrentId}/peers?page=${p}&limit=${PAGE_SIZE}&userLat=${userLat}&userLon=${userLon}`,
				);
				const data = await res.json();

				const enriched: Peer[] = data.peers.map(
					(peer: Omit<Peer, "distanceKm">) => ({
						...peer,
						distanceKm:
							peer.lat != null && peer.lon != null
								? Math.round(
										haversineDistance(userLat, userLon, peer.lat, peer.lon),
									)
								: null,
					}),
				);

				setPeers((prev) => {
					if (p === 1) return enriched;
					// Deduplicate by ip:port
					const existing = new Set(prev.map((x) => `${x.ip}:${x.port}`));
					const newPeers = enriched.filter(
						(x) => !existing.has(`${x.ip}:${x.port}`),
					);
					return [...prev, ...newPeers];
				});
				setHasMore(data.hasMore);
				setPage(p);
			} finally {
				setLoading(false);
			}
		},
		[torrentId, userLat, userLon],
	);

	// Initial load
	useEffect(() => {
		fetchPage(1);
	}, [fetchPage]);

	// Infinite scroll with IntersectionObserver
	useEffect(() => {
		if (!sentinelRef.current || !hasMore || loading) return;

		const needsButton = autoLoadCount >= LOAD_MORE_EVERY;
		if (needsButton) return; // Wait for manual "Load more" click

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					setAutoLoadCount((c) => c + 1);
					fetchPage(page + 1);
				}
			},
			{ rootMargin: "200px" },
		);

		observer.observe(sentinelRef.current);
		return () => observer.disconnect();
	}, [hasMore, loading, page, autoLoadCount, fetchPage]);

	function handleLoadMore() {
		setAutoLoadCount(0);
		fetchPage(page + 1);
	}

	const showLoadMoreButton =
		hasMore && !loading && autoLoadCount >= LOAD_MORE_EVERY;

	return (
		<div>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[30px]" />
							<TableHead>IP</TableHead>
							<TableHead>Port</TableHead>
							<TableHead>Source</TableHead>
							<TableHead>Distance</TableHead>
							<TableHead>Last Seen</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{peers.length === 0 && !loading && (
							<TableRow>
								<TableCell
									colSpan={6}
									className="text-center text-muted-foreground py-4"
								>
									No peers discovered yet.
								</TableCell>
							</TableRow>
						)}
						{peers.map((peer) => (
							<TableRow key={`${peer.ip}:${peer.port}`}>
								<TableCell className="pr-0">
									<PeerFlag
										countryCode={peer.countryCode ?? undefined}
										countryName={peer.countryName ?? undefined}
									/>
								</TableCell>
								<TableCell className="font-mono text-xs">{peer.ip}</TableCell>
								<TableCell className="font-mono text-xs">{peer.port}</TableCell>
								<TableCell>
									<div className="flex gap-1">
										{peer.sources.map((s) => (
											<Badge key={s} variant="outline" className="text-xs">
												{s}
											</Badge>
										))}
									</div>
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{peer.distanceKm !== null
										? `${peer.distanceKm.toLocaleString()} km`
										: "-"}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{new Date(peer.lastSeenAt).toLocaleString()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Sentinel for auto-scroll or load more button */}
			<div ref={sentinelRef} className="h-1" />

			{showLoadMoreButton && (
				<div className="flex justify-center py-4">
					<Button variant="outline" onClick={handleLoadMore}>
						Load more peers
					</Button>
				</div>
			)}

			{loading && (
				<div className="flex justify-center py-4">
					<span className="text-sm text-muted-foreground">Loading...</span>
				</div>
			)}

			{!hasMore && peers.length > 0 && (
				<p className="text-center text-xs text-muted-foreground py-2">
					Showing all {peers.length} unique peers
				</p>
			)}
		</div>
	);
}
