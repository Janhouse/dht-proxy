import { describe, expect, test } from "bun:test";
import bencode from "bencode";
import {
	buildAnnounceResponse,
	buildMagnetUri,
	createPrivateTorrent,
	encodeCompactPeers,
	parseInfoHashFromQuery,
	parseMagnetOrTorrent,
} from "../lib/torrent/torrent-utils";

describe("parseMagnetOrTorrent", () => {
	test("parses a magnet URI with infohash and name", async () => {
		const magnet =
			"magnet:?xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0&dn=Test+Torrent&tr=http://tracker.example.com/announce";
		const result = await parseMagnetOrTorrent(magnet);

		expect(result.infoHash).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
		expect(result.name).toBe("Test Torrent");
		expect(result.announce).toContain("http://tracker.example.com/announce");
	});

	test("parses a magnet URI with only infohash", async () => {
		const magnet =
			"magnet:?xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
		const result = await parseMagnetOrTorrent(magnet);

		expect(result.infoHash).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
	});

	test("parses a .torrent file buffer", async () => {
		// Create a minimal valid torrent
		const infoDict = {
			name: "test-file.txt",
			"piece length": 262144,
			pieces: new Uint8Array(20), // one fake piece hash
			length: 1024,
		};
		const torrentBuf = bencode.encode({
			info: infoDict,
			announce: "http://tracker.example.com/announce",
		});

		const result = await parseMagnetOrTorrent(torrentBuf);

		expect(result.infoHash).toBeTruthy();
		expect(result.infoHash.length).toBe(40);
		expect(result.name).toBe("test-file.txt");
		expect(result.announce).toContain("http://tracker.example.com/announce");
		expect(result.infoBuffer).toBeTruthy();
	});
});

describe("createPrivateTorrent", () => {
	test("rewrites announce URL when infoBuffer is available", async () => {
		const infoDict = {
			name: "test-file.txt",
			"piece length": 262144,
			pieces: new Uint8Array(20),
			length: 1024,
		};
		const torrentBuf = bencode.encode({
			info: infoDict,
			announce: "http://old-tracker.example.com/announce",
		});

		const parsed = await parseMagnetOrTorrent(torrentBuf);
		const privateTorrent = createPrivateTorrent(
			parsed,
			"http://my-proxy.example.com/api/announce",
		);

		const decoded = bencode.decode(privateTorrent) as Record<string, unknown>;
		const announce = decoded.announce;
		const announceStr =
			announce instanceof Uint8Array
				? new TextDecoder().decode(announce)
				: String(announce);

		expect(announceStr).toContain("http://my-proxy.example.com/api/announce");
		expect(announceStr).toContain(`info_hash_hex=${parsed.infoHash}`);
		expect(decoded.info).toBeTruthy();
	});

	test("creates magnet-info torrent for magnet-only input", async () => {
		const magnet =
			"magnet:?xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0&dn=Test";
		const parsed = await parseMagnetOrTorrent(magnet);

		const privateTorrent = createPrivateTorrent(
			parsed,
			"http://my-proxy.example.com/api/announce",
		);

		const decoded = bencode.decode(privateTorrent) as Record<string, unknown>;
		const announce = decoded.announce;
		const announceStr =
			announce instanceof Uint8Array
				? new TextDecoder().decode(announce)
				: String(announce);

		expect(announceStr).toContain("http://my-proxy.example.com/api/announce");
		expect(announceStr).toContain(
			"info_hash_hex=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
		);
	});
});

describe("encodeCompactPeers", () => {
	test("encodes peers as 6-byte compact format", () => {
		const peers = [
			{ ip: "192.168.1.1", port: 6881 },
			{ ip: "10.0.0.1", port: 8080 },
		];

		const encoded = encodeCompactPeers(peers);

		expect(encoded.length).toBe(12);
		// First peer: 192.168.1.1:6881
		expect(encoded[0]).toBe(192);
		expect(encoded[1]).toBe(168);
		expect(encoded[2]).toBe(1);
		expect(encoded[3]).toBe(1);
		expect((encoded[4] << 8) | encoded[5]).toBe(6881);
		// Second peer: 10.0.0.1:8080
		expect(encoded[6]).toBe(10);
		expect(encoded[7]).toBe(0);
		expect(encoded[8]).toBe(0);
		expect(encoded[9]).toBe(1);
		expect((encoded[10] << 8) | encoded[11]).toBe(8080);
	});

	test("returns empty buffer for no peers", () => {
		const encoded = encodeCompactPeers([]);
		expect(encoded.length).toBe(0);
	});
});

describe("buildAnnounceResponse", () => {
	test("builds valid bencoded response with peers", () => {
		const peers = [{ ip: "192.168.1.1", port: 6881 }];
		const response = buildAnnounceResponse(peers, 900);

		const decoded = bencode.decode(response) as Record<string, unknown>;
		expect(decoded.interval).toBe(900);
		expect(decoded.incomplete).toBe(1);
		expect(decoded.complete).toBe(0);
		expect(decoded.peers).toBeTruthy();

		const peersData = decoded.peers as Uint8Array;
		expect(peersData.length).toBe(6);
	});

	test("builds response with empty peer list", () => {
		const response = buildAnnounceResponse([]);
		const decoded = bencode.decode(response) as Record<string, unknown>;

		expect(decoded.interval).toBe(1800);
		expect(decoded.incomplete).toBe(0);
		const peersData = decoded.peers as Uint8Array;
		expect(peersData.length).toBe(0);
	});
});

describe("parseInfoHashFromQuery", () => {
	test("parses hex string info_hash", () => {
		const result = parseInfoHashFromQuery(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
		);
		expect(result).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
	});

	test("parses URL-encoded binary info_hash", () => {
		// 20 bytes all zeros
		const encoded = "%00".repeat(20);
		const result = parseInfoHashFromQuery(encoded);
		expect(result).toBe("0000000000000000000000000000000000000000");
	});

	test("returns null for invalid input", () => {
		expect(parseInfoHashFromQuery("tooshort")).toBeNull();
		expect(parseInfoHashFromQuery("")).toBeNull();
	});
});

describe("buildMagnetUri", () => {
	test("builds magnet URI with name and announce", () => {
		const uri = buildMagnetUri(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
			"Test Torrent",
			"http://example.com/api/announce",
		);

		expect(uri).toContain(
			"xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
		);
		expect(uri).toContain("dn=Test%20Torrent");
		expect(uri).toContain(
			`tr=${encodeURIComponent("http://example.com/api/announce")}`,
		);
	});

	test("builds magnet URI without name", () => {
		const uri = buildMagnetUri(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
			null,
			"http://example.com/api/announce",
		);

		expect(uri).not.toContain("dn=");
	});
});
