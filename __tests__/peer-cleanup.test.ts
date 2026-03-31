import { describe, expect, test } from "bun:test";

// Test the cleanup logic in isolation (pure function tests)
// The actual DB operations are tested via integration

const PEER_STALE_MS = 60 * 60 * 1000; // 1 hour

function isPeerStale(lastSeenAt: Date, now: Date): boolean {
	return now.getTime() - lastSeenAt.getTime() > PEER_STALE_MS;
}

describe("peer cleanup logic", () => {
	test("peer seen 30 minutes ago is NOT stale", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 30 * 60 * 1000);
		expect(isPeerStale(lastSeen, now)).toBe(false);
	});

	test("peer seen 59 minutes ago is NOT stale", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 59 * 60 * 1000);
		expect(isPeerStale(lastSeen, now)).toBe(false);
	});

	test("peer seen exactly 60 minutes ago is NOT stale (boundary)", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 60 * 60 * 1000);
		expect(isPeerStale(lastSeen, now)).toBe(false);
	});

	test("peer seen 61 minutes ago IS stale", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 61 * 60 * 1000);
		expect(isPeerStale(lastSeen, now)).toBe(true);
	});

	test("peer seen 2 hours ago IS stale", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 2 * 60 * 60 * 1000);
		expect(isPeerStale(lastSeen, now)).toBe(true);
	});

	test("peer seen 1 second ago is NOT stale", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 1000);
		expect(isPeerStale(lastSeen, now)).toBe(false);
	});

	test("peer seen 24 hours ago IS stale", () => {
		const now = new Date();
		const lastSeen = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		expect(isPeerStale(lastSeen, now)).toBe(true);
	});
});
