"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TorrentStatusData {
	id: string;
	infoHash: string;
	crawlStatus: string;
	lastAnnounceAt: string | null;
	lastQueryAt: string | null;
	peerCount: number;
	seeders: number;
	leechers: number;
	isCrawling: boolean;
	pausesAt: string | null;
}

const POLL_INTERVAL = 5000;

function useStatusPoll() {
	const [statuses, setStatuses] = useState<Map<string, TorrentStatusData>>(
		new Map(),
	);

	const fetchStatuses = useCallback(async () => {
		try {
			const res = await fetch("/api/torrents/status");
			if (!res.ok) return;
			const data: TorrentStatusData[] = await res.json();
			setStatuses(new Map(data.map((s) => [s.id, s])));
		} catch {
			// ignore fetch errors
		}
	}, []);

	useEffect(() => {
		fetchStatuses();
		const interval = setInterval(fetchStatuses, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [fetchStatuses]);

	return statuses;
}

export function useTorrentStatuses() {
	return useStatusPoll();
}

export function StatusBadge({
	crawlStatus,
	isCrawling,
}: {
	crawlStatus: string;
	isCrawling: boolean;
}) {
	if (isCrawling) {
		return (
			<Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20">
				Crawling
			</Badge>
		);
	}
	if (crawlStatus === "paused") {
		return (
			<Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
				Paused
			</Badge>
		);
	}
	return (
		<Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20">
			Active
		</Badge>
	);
}

export function PauseCountdown({ pausesAt }: { pausesAt: string | null }) {
	const [remaining, setRemaining] = useState("");

	useEffect(() => {
		if (!pausesAt) {
			setRemaining("");
			return;
		}

		function update() {
			const ms = new Date(pausesAt!).getTime() - Date.now();
			if (ms <= 0) {
				setRemaining("pausing...");
				return;
			}
			const min = Math.floor(ms / 60000);
			const sec = Math.floor((ms % 60000) / 1000);
			setRemaining(`${min}m ${sec}s`);
		}

		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [pausesAt]);

	if (!remaining) return null;

	return (
		<span className="text-xs text-muted-foreground">pauses in {remaining}</span>
	);
}

export function LiveStats({
	torrentId,
	initialPeerCount,
	initialSeeders,
	initialLeechers,
	initialCrawlStatus,
}: {
	torrentId: string;
	initialPeerCount: number;
	initialSeeders: number;
	initialLeechers: number;
	initialCrawlStatus: string;
}) {
	const statuses = useTorrentStatuses();
	const live = statuses.get(torrentId);

	const peerCount = live?.peerCount ?? initialPeerCount;
	const seeders = live?.seeders ?? initialSeeders;
	const leechers = live?.leechers ?? initialLeechers;
	const crawlStatus = live?.crawlStatus ?? initialCrawlStatus;
	const crawling = live?.isCrawling ?? false;
	const pausesAt = live?.pausesAt ?? null;

	return (
		<div className="flex items-center gap-3 flex-wrap">
			<StatusBadge crawlStatus={crawlStatus} isCrawling={crawling} />
			<PauseCountdown pausesAt={crawlStatus === "active" ? pausesAt : null} />
			<span className="text-xs text-muted-foreground">{peerCount} peers</span>
			<span className="text-xs text-muted-foreground">
				{seeders}S / {leechers}L
			</span>
		</div>
	);
}
