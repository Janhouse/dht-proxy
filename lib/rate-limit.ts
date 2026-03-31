/**
 * Simple in-memory sliding window rate limiter.
 * Not shared across instances — suitable for single-process deployments.
 */

interface WindowEntry {
	count: number;
	resetAt: number;
}

const windows = new Map<string, WindowEntry>();

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of windows) {
		if (now >= entry.resetAt) {
			windows.delete(key);
		}
	}
}, 60_000);

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

/**
 * Check and consume a rate limit token.
 * @param key - Unique identifier (e.g., "add:1.2.3.4")
 * @param maxRequests - Max requests per window
 * @param windowMs - Window duration in milliseconds
 */
export function rateLimit(
	key: string,
	maxRequests: number,
	windowMs: number,
): RateLimitResult {
	const now = Date.now();
	const entry = windows.get(key);

	if (!entry || now >= entry.resetAt) {
		// New window
		windows.set(key, { count: 1, resetAt: now + windowMs });
		return {
			allowed: true,
			remaining: maxRequests - 1,
			resetAt: now + windowMs,
		};
	}

	if (entry.count >= maxRequests) {
		return { allowed: false, remaining: 0, resetAt: entry.resetAt };
	}

	entry.count++;
	return {
		allowed: true,
		remaining: maxRequests - entry.count,
		resetAt: entry.resetAt,
	};
}
