"use client";

import { RefreshCwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	PauseCountdown,
	StatusBadge,
	useTorrentStatuses,
} from "@/components/torrent-status";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface TorrentRow {
	id: string;
	infoHash: string;
	name: string | null;
	peerCount: number;
	seeders: number;
	leechers: number;
	crawlStatus: string;
	lastAnnounceAt: string | null;
	lastQueryAt: string | null;
	expiresAt: string;
	isActive: boolean;
}

function timeAgo(dateStr: string | null): string {
	if (!dateStr) return "Never";
	const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function TorrentListLive({
	initialData,
	total,
	page,
	hasMore,
}: {
	initialData: TorrentRow[];
	total: number;
	page: number;
	hasMore: boolean;
}) {
	const router = useRouter();
	const statuses = useTorrentStatuses();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [batchLoading, setBatchLoading] = useState(false);

	const allSelected =
		initialData.length > 0 && selected.size === initialData.length;

	function toggleSelect(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAll() {
		if (allSelected) {
			setSelected(new Set());
		} else {
			setSelected(new Set(initialData.map((t) => t.id)));
		}
	}

	async function batchDelete() {
		setBatchLoading(true);
		await Promise.all(
			[...selected].map((id) =>
				fetch(`/api/torrents/${id}`, { method: "DELETE" }),
			),
		);
		setSelected(new Set());
		setShowDeleteDialog(false);
		setBatchLoading(false);
		router.refresh();
	}

	async function batchRecrawl() {
		setBatchLoading(true);
		await Promise.all(
			[...selected].map((id) =>
				fetch(`/api/torrents/${id}/recrawl`, { method: "POST" }),
			),
		);
		setBatchLoading(false);
		router.refresh();
	}

	return (
		<div className="space-y-3">
			{selected.size > 0 && (
				<div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
					<span className="text-sm font-medium">{selected.size} selected</span>
					<Button
						variant="outline"
						size="sm"
						onClick={batchRecrawl}
						disabled={batchLoading}
					>
						<RefreshCwIcon className={batchLoading ? "animate-spin" : ""} />
						Re-crawl
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setShowDeleteDialog(true)}
						disabled={batchLoading}
					>
						<Trash2Icon />
						Delete
					</Button>
				</div>
			)}

			{/* Mobile card view */}
			<div className="space-y-2 lg:hidden">
				{initialData.length === 0 && (
					<p className="text-center text-muted-foreground py-8">
						No torrents added yet.
					</p>
				)}
				{initialData.map((torrent) => {
					const live = statuses.get(torrent.id);
					const crawlStatus = live?.crawlStatus ?? torrent.crawlStatus;
					const crawling = live?.isCrawling ?? false;
					const peerCount = live?.peerCount ?? torrent.peerCount;
					const seeders = live?.seeders ?? torrent.seeders;
					const leechers = live?.leechers ?? torrent.leechers;
					const pausesAt = live?.pausesAt ?? null;

					return (
						<div
							key={torrent.id}
							className="rounded-lg border bg-card p-3 space-y-2"
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex items-start gap-2 min-w-0">
									<Checkbox
										checked={selected.has(torrent.id)}
										onCheckedChange={() => toggleSelect(torrent.id)}
										className="mt-1"
									/>
									<div className="min-w-0">
										<Link
											href={`/admin/torrents/${torrent.id}`}
											className="hover:underline font-medium text-sm truncate block"
										>
											{torrent.name || "Unnamed"}
										</Link>
										<span className="text-[10px] text-muted-foreground font-mono">
											{torrent.infoHash.substring(0, 12)}...
										</span>
									</div>
								</div>
								<StatusBadge crawlStatus={crawlStatus} isCrawling={crawling} />
							</div>
							<div className="flex items-center gap-3 text-xs text-muted-foreground">
								<span>{peerCount} peers</span>
								<span>
									{seeders}/{leechers} S/L
								</span>
								<span>{torrent.expiresAt}</span>
								{crawlStatus === "active" && pausesAt && (
									<PauseCountdown pausesAt={pausesAt} />
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Desktop table view */}
			<div className="rounded-md border hidden lg:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10">
								<Checkbox checked={allSelected} onCheckedChange={toggleAll} />
							</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Peers</TableHead>
							<TableHead className="text-right">S/L</TableHead>
							<TableHead>Last Query</TableHead>
							<TableHead>Expires</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{initialData.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={7}
									className="text-center text-muted-foreground py-8"
								>
									No torrents added yet.
								</TableCell>
							</TableRow>
						)}
						{initialData.map((torrent) => {
							const live = statuses.get(torrent.id);
							const crawlStatus = live?.crawlStatus ?? torrent.crawlStatus;
							const crawling = live?.isCrawling ?? false;
							const peerCount = live?.peerCount ?? torrent.peerCount;
							const seeders = live?.seeders ?? torrent.seeders;
							const leechers = live?.leechers ?? torrent.leechers;
							const lastQueryAt = live?.lastQueryAt ?? torrent.lastQueryAt;
							const pausesAt = live?.pausesAt ?? null;

							return (
								<TableRow key={torrent.id}>
									<TableCell>
										<Checkbox
											checked={selected.has(torrent.id)}
											onCheckedChange={() => toggleSelect(torrent.id)}
										/>
									</TableCell>
									<TableCell className="max-w-[250px]">
										<Link
											href={`/admin/torrents/${torrent.id}`}
											className="hover:underline truncate block font-medium"
										>
											{torrent.name || "Unnamed"}
										</Link>
										<span className="text-xs text-muted-foreground font-mono truncate block">
											{torrent.infoHash.substring(0, 16)}...
										</span>
									</TableCell>
									<TableCell>
										<div className="flex flex-col gap-1">
											<StatusBadge
												crawlStatus={crawlStatus}
												isCrawling={crawling}
											/>
											{crawlStatus === "active" && (
												<PauseCountdown pausesAt={pausesAt} />
											)}
										</div>
									</TableCell>
									<TableCell className="text-right">{peerCount}</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{seeders}/{leechers}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{timeAgo(lastQueryAt)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{torrent.expiresAt}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Page {page} of {Math.ceil(total / initialData.length) || 1} ({total}{" "}
					total)
				</p>
				<div className="flex gap-2">
					{page > 1 && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push(`/admin/torrents?page=${page - 1}`)}
						>
							Previous
						</Button>
					)}
					{hasMore && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push(`/admin/torrents?page=${page + 1}`)}
						>
							Next
						</Button>
					)}
				</div>
			</div>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {selected.size} torrent{selected.size > 1 ? "s" : ""}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the selected torrents and all their
							discovered peers. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={batchDelete}>
							{batchLoading ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
