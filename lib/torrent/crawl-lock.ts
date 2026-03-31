/**
 * In-memory lock for initial crawl after torrent addition.
 * The announce endpoint can wait on this to avoid returning empty peers
 * for freshly added torrents.
 */

declare global {
	var __crawlLocks: Map<string, Promise<void>> | undefined;
}

if (!globalThis.__crawlLocks) {
	globalThis.__crawlLocks = new Map<string, Promise<void>>();
}
const locks = globalThis.__crawlLocks;

/**
 * Register an active crawl for an infohash.
 * Returns a resolve function to call when crawl is done.
 */
export function startCrawlLock(infoHash: string): () => void {
	let resolve: () => void;
	const promise = new Promise<void>((r) => {
		resolve = r;
	});

	// Auto-expire after 30s
	const timeout = setTimeout(() => {
		locks.delete(infoHash);
		resolve!();
	}, 30_000);

	locks.set(infoHash, promise);

	return () => {
		clearTimeout(timeout);
		locks.delete(infoHash);
		resolve!();
	};
}

/**
 * Wait for an active crawl to finish (up to 30s).
 * Returns immediately if no crawl is in progress.
 */
export async function waitForCrawl(infoHash: string): Promise<void> {
	const lock = locks.get(infoHash);
	if (lock) {
		await lock;
	}
}

/**
 * Check if a crawl is currently in progress for this infohash.
 */
export function isCrawling(infoHash: string): boolean {
	return locks.has(infoHash);
}
