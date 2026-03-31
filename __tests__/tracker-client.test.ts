import { describe, expect, test } from "bun:test";
import bencode from "bencode";
import {
	decodeCompactPeers,
	parseCompactTrackerResponse,
} from "../lib/torrent/tracker-client";

describe("decodeCompactPeers", () => {
	test("decodes compact peer format correctly", () => {
		// Encode two peers: 8.8.8.8:6881 and 1.2.3.4:8080
		const data = new Uint8Array([
			8,
			8,
			8,
			8,
			0x1a,
			0xe1, // 8.8.8.8:6881
			1,
			2,
			3,
			4,
			0x1f,
			0x90, // 1.2.3.4:8080
		]);

		const peers = decodeCompactPeers(data);

		expect(peers).toHaveLength(2);
		expect(peers[0]).toEqual({ ip: "8.8.8.8", port: 6881 });
		expect(peers[1]).toEqual({ ip: "1.2.3.4", port: 8080 });
	});

	test("skips peers with port 0", () => {
		const data = new Uint8Array([
			8,
			8,
			8,
			8,
			0,
			0, // port 0 — skip
			1,
			2,
			3,
			4,
			0x1a,
			0xe1, // valid
		]);

		const peers = decodeCompactPeers(data);
		expect(peers).toHaveLength(1);
		expect(peers[0].ip).toBe("1.2.3.4");
	});

	test("skips 0.0.0.0 addresses", () => {
		const data = new Uint8Array([
			0,
			0,
			0,
			0,
			0x1a,
			0xe1, // 0.0.0.0 — skip
		]);

		const peers = decodeCompactPeers(data);
		expect(peers).toHaveLength(0);
	});

	test("handles empty data", () => {
		const peers = decodeCompactPeers(new Uint8Array(0));
		expect(peers).toHaveLength(0);
	});

	test("handles truncated data (less than 6 bytes)", () => {
		const data = new Uint8Array([192, 168, 1]);
		const peers = decodeCompactPeers(data);
		expect(peers).toHaveLength(0);
	});
});

describe("parseCompactTrackerResponse", () => {
	test("parses valid bencoded compact response with stats", () => {
		const peerData = new Uint8Array([
			8,
			8,
			8,
			8,
			0x1a,
			0xe1, // 8.8.8.8:6881
		]);

		const response = bencode.encode({
			interval: 1800,
			complete: 5,
			incomplete: 3,
			peers: peerData,
		});

		const result = parseCompactTrackerResponse(response);
		expect(result.peers).toHaveLength(1);
		expect(result.peers[0]).toEqual({ ip: "8.8.8.8", port: 6881 });
		expect(result.complete).toBe(5);
		expect(result.incomplete).toBe(3);
	});

	test("handles failure reason", () => {
		const response = bencode.encode({
			"failure reason": "torrent not found",
		});

		const result = parseCompactTrackerResponse(response);
		expect(result.peers).toHaveLength(0);
	});

	test("handles empty peers", () => {
		const response = bencode.encode({
			interval: 1800,
			peers: new Uint8Array(0),
		});

		const result = parseCompactTrackerResponse(response);
		expect(result.peers).toHaveLength(0);
	});

	test("handles invalid bencoded data", () => {
		const result = parseCompactTrackerResponse(new Uint8Array([0, 1, 2, 3]));
		expect(result.peers).toHaveLength(0);
	});
});
