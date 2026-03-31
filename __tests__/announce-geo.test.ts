import { describe, expect, test } from "bun:test";

// Approximate degrees for 1000km
const CLOSE_DISTANCE_DEG = 9;

interface Peer {
	ip: string;
	port: number;
	lat: number | null;
	lon: number | null;
}

/**
 * Pure function version of the announce peer selection logic.
 * Mirrors the SQL-based approach in the route handler.
 */
function selectPeers(
	allPeers: Peer[],
	numwant: number,
	clientLat: number | null,
	clientLon: number | null,
): Peer[] {
	if (!clientLat || !clientLon) {
		// No geo — return random peers up to numwant
		const shuffled = [...allPeers].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, numwant);
	}

	// Split into close and far peers
	const closePeers = allPeers.filter(
		(p) =>
			p.lat !== null &&
			p.lon !== null &&
			Math.abs(p.lat - clientLat) < CLOSE_DISTANCE_DEG &&
			Math.abs(p.lon - clientLon) < CLOSE_DISTANCE_DEG * 1.5,
	);

	const farPeers = allPeers.filter((p) => !closePeers.includes(p));

	// Shuffle close peers for randomness
	const shuffledClose = [...closePeers].sort(() => Math.random() - 0.5);

	if (shuffledClose.length >= numwant) {
		return shuffledClose.slice(0, numwant);
	}

	// Fill with random far peers
	const shuffledFar = [...farPeers].sort(() => Math.random() - 0.5);
	return [
		...shuffledClose,
		...shuffledFar.slice(0, numwant - shuffledClose.length),
	];
}

describe("announce geo-sorted peer selection", () => {
	const rigaLat = 56.95;
	const rigaLon = 24.11;

	const peers: Peer[] = [
		// Close to Riga (within ~1000km)
		{ ip: "1.1.1.1", port: 6881, lat: 59.33, lon: 18.07 }, // Stockholm ~500km
		{ ip: "2.2.2.2", port: 6881, lat: 54.69, lon: 25.28 }, // Vilnius ~260km
		{ ip: "3.3.3.3", port: 6881, lat: 59.44, lon: 24.75 }, // Tallinn ~310km
		{ ip: "4.4.4.4", port: 6881, lat: 60.17, lon: 24.94 }, // Helsinki ~400km
		// Far from Riga (>1000km)
		{ ip: "5.5.5.5", port: 6881, lat: 40.71, lon: -74.01 }, // New York
		{ ip: "6.6.6.6", port: 6881, lat: -33.87, lon: 151.21 }, // Sydney
		{ ip: "7.7.7.7", port: 6881, lat: 35.68, lon: 139.69 }, // Tokyo
		// No geo data
		{ ip: "8.8.8.8", port: 6881, lat: null, lon: null },
	];

	test("returns only numwant peers", () => {
		const result = selectPeers(peers, 3, rigaLat, rigaLon);
		expect(result.length).toBe(3);
	});

	test("prefers close peers when enough available", () => {
		const result = selectPeers(peers, 3, rigaLat, rigaLon);
		// All 3 should be from the close pool (4 close peers available)
		const closeIps = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"];
		for (const p of result) {
			expect(closeIps).toContain(p.ip);
		}
	});

	test("fills with far peers when not enough close", () => {
		const result = selectPeers(peers, 6, rigaLat, rigaLon);
		expect(result.length).toBe(6);
		// Should include all 4 close + 2 from far/no-geo
		const closeCount = result.filter((p) =>
			["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].includes(p.ip),
		).length;
		expect(closeCount).toBe(4);
	});

	test("returns all peers when numwant exceeds total", () => {
		const result = selectPeers(peers, 100, rigaLat, rigaLon);
		expect(result.length).toBe(peers.length);
	});

	test("returns random peers when no client geo", () => {
		const result = selectPeers(peers, 3, null, null);
		expect(result.length).toBe(3);
	});

	test("returns random subset when no client geo (not always same)", () => {
		// Run multiple times — should occasionally differ
		const results = new Set<string>();
		for (let i = 0; i < 20; i++) {
			const r = selectPeers(peers, 3, null, null);
			results.add(
				r
					.map((p) => p.ip)
					.sort()
					.join(","),
			);
		}
		// Should have at least 2 different combinations in 20 runs
		expect(results.size).toBeGreaterThan(1);
	});

	test("handles empty peer list", () => {
		const result = selectPeers([], 10, rigaLat, rigaLon);
		expect(result.length).toBe(0);
	});

	test("handles peers with no geo data gracefully", () => {
		const noGeoPeers: Peer[] = [
			{ ip: "1.1.1.1", port: 6881, lat: null, lon: null },
			{ ip: "2.2.2.2", port: 6881, lat: null, lon: null },
		];
		const result = selectPeers(noGeoPeers, 2, rigaLat, rigaLon);
		expect(result.length).toBe(2);
	});
});
