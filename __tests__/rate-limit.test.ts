import { describe, expect, test } from "bun:test";
import { rateLimit } from "../lib/rate-limit";

describe("rateLimit", () => {
	test("allows requests within limit", () => {
		const key = `test-allow-${Date.now()}`;
		const result = rateLimit(key, 5, 60_000);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(4);
	});

	test("blocks requests exceeding limit", () => {
		const key = `test-block-${Date.now()}`;
		for (let i = 0; i < 3; i++) {
			rateLimit(key, 3, 60_000);
		}
		const result = rateLimit(key, 3, 60_000);
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	test("resets after window expires", async () => {
		const key = `test-reset-${Date.now()}`;
		// Use up limit with a very short window
		for (let i = 0; i < 2; i++) {
			rateLimit(key, 2, 50);
		}
		const blocked = rateLimit(key, 2, 50);
		expect(blocked.allowed).toBe(false);

		// Wait for window to expire
		await new Promise((r) => setTimeout(r, 60));

		const allowed = rateLimit(key, 2, 50);
		expect(allowed.allowed).toBe(true);
	});

	test("tracks different keys independently", () => {
		const key1 = `test-key1-${Date.now()}`;
		const key2 = `test-key2-${Date.now()}`;

		// Exhaust key1
		for (let i = 0; i < 2; i++) {
			rateLimit(key1, 2, 60_000);
		}
		expect(rateLimit(key1, 2, 60_000).allowed).toBe(false);

		// key2 should still be allowed
		expect(rateLimit(key2, 2, 60_000).allowed).toBe(true);
	});

	test("remaining count decreases correctly", () => {
		const key = `test-remaining-${Date.now()}`;
		expect(rateLimit(key, 5, 60_000).remaining).toBe(4);
		expect(rateLimit(key, 5, 60_000).remaining).toBe(3);
		expect(rateLimit(key, 5, 60_000).remaining).toBe(2);
		expect(rateLimit(key, 5, 60_000).remaining).toBe(1);
		expect(rateLimit(key, 5, 60_000).remaining).toBe(0);
	});
});
