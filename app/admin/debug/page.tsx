"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemoryStats } from "@/lib/debug-service";
import { formatBytes } from "@/lib/utils";

export default function DebugPage() {
	const [downloading, setDownloading] = useState(false);
	const [lastSize, setLastSize] = useState<string | null>(null);
	const [heapError, setHeapError] = useState<string | null>(null);

	const [stats, setStats] = useState<MemoryStats | null>(null);
	const [loadingStats, setLoadingStats] = useState(false);
	const [statsError, setStatsError] = useState<string | null>(null);

	async function handleHeapDump() {
		setDownloading(true);
		setHeapError(null);
		setLastSize(null);

		try {
			const res = await fetch("/api/debug/heap");
			if (!res.ok) {
				setHeapError(`Failed: ${res.status} ${res.statusText}`);
				return;
			}

			const blob = await res.blob();
			setLastSize(formatBytes(blob.size));

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `heap-${Date.now()}.heapsnapshot`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			setHeapError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setDownloading(false);
		}
	}

	const handleLoadStats = useCallback(async () => {
		setLoadingStats(true);
		setStatsError(null);

		try {
			const res = await fetch("/api/debug/stats");
			if (!res.ok) {
				setStatsError(`Failed: ${res.status} ${res.statusText}`);
				return;
			}
			setStats(await res.json());
		} catch (err) {
			setStatsError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoadingStats(false);
		}
	}, []);

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Debug</h1>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">Heap Snapshot</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Download a .heapsnapshot file for Chrome DevTools. Open DevTools
							&rarr; Memory tab &rarr; Load to analyze.
						</p>

						<Button onClick={handleHeapDump} disabled={downloading}>
							{downloading ? "Generating..." : "Download Heap Dump"}
						</Button>

						{lastSize && (
							<p className="text-sm text-muted-foreground">
								Last snapshot: {lastSize}
							</p>
						)}

						{heapError && (
							<p className="text-sm text-destructive">{heapError}</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">
							Memory Statistics
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Live JSC heap statistics and process memory usage.
						</p>

						<Button onClick={handleLoadStats} disabled={loadingStats}>
							{loadingStats ? "Loading..." : stats ? "Refresh" : "Load Stats"}
						</Button>

						{statsError && (
							<p className="text-sm text-destructive">{statsError}</p>
						)}

						{stats && (
							<div className="space-y-3 text-sm">
								<div>
									<h4 className="font-medium mb-1">Process Memory</h4>
									<dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
										<dt>RSS</dt>
										<dd className="font-mono">{formatBytes(stats.rss)}</dd>
										<dt>Heap Used</dt>
										<dd className="font-mono">{formatBytes(stats.heapUsed)}</dd>
										<dt>Heap Total</dt>
										<dd className="font-mono">
											{formatBytes(stats.heapTotal)}
										</dd>
										<dt>External</dt>
										<dd className="font-mono">{formatBytes(stats.external)}</dd>
										<dt>ArrayBuffers</dt>
										<dd className="font-mono">
											{formatBytes(stats.arrayBuffers)}
										</dd>
									</dl>
								</div>

								<div>
									<h4 className="font-medium mb-1">JSC Heap</h4>
									<dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
										<dt>Heap Size</dt>
										<dd className="font-mono">
											{formatBytes(stats.jsc.heapSize)}
										</dd>
										<dt>Heap Capacity</dt>
										<dd className="font-mono">
											{formatBytes(stats.jsc.heapCapacity)}
										</dd>
										<dt>Extra Memory</dt>
										<dd className="font-mono">
											{formatBytes(stats.jsc.extraMemorySize)}
										</dd>
										<dt>Objects</dt>
										<dd className="font-mono">
											{stats.jsc.objectCount.toLocaleString()}
										</dd>
										<dt>Protected</dt>
										<dd className="font-mono">
											{stats.jsc.protectedObjectCount.toLocaleString()}
										</dd>
									</dl>
								</div>

								<div>
									<h4 className="font-medium mb-1">
										Top Object Types (by count)
									</h4>
									<dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground font-mono text-xs">
										{Object.entries(stats.jsc.objectTypeCounts)
											.sort(([, a], [, b]) => b - a)
											.slice(0, 15)
											.map(([type, count]) => (
												<>
													<dt key={`${type}-dt`} className="truncate">
														{type}
													</dt>
													<dd key={`${type}-dd`}>{count.toLocaleString()}</dd>
												</>
											))}
									</dl>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
