import { describe, expect, test } from "bun:test";
import bencode from "bencode";
import {
	buildMagnetUri,
	createPrivateTorrent,
	parseMagnetOrTorrent,
} from "../lib/torrent/torrent-utils";

describe("addTorrent response types", () => {
	const announceUrl = "http://proxy.example.com/api/announce";

	test("torrent file input returns valid .torrent with rewritten announce", async () => {
		const infoDict = {
			name: "test-file.txt",
			"piece length": 262144,
			pieces: new Uint8Array(20),
			length: 1024,
		};
		const original = bencode.encode({
			info: infoDict,
			announce: "http://old-tracker.example.com/announce",
		});

		const parsed = await parseMagnetOrTorrent(original);
		expect(parsed.infoBuffer).toBeTruthy();

		const torrentFile = createPrivateTorrent(parsed, announceUrl);
		expect(torrentFile).toBeTruthy();

		// Should be valid bencode
		const decoded = bencode.decode(torrentFile) as Record<string, unknown>;
		expect(decoded.info).toBeTruthy();

		// Announce should contain our URL + info_hash_hex
		const announce =
			decoded.announce instanceof Uint8Array
				? new TextDecoder().decode(decoded.announce)
				: String(decoded.announce);
		expect(announce).toContain(announceUrl);
		expect(announce).toContain("info_hash_hex=");
	});

	test("magnet-only input has no infoBuffer", async () => {
		const magnet =
			"magnet:?xt=urn:btih:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0&dn=Test";
		const parsed = await parseMagnetOrTorrent(magnet);

		expect(parsed.infoBuffer).toBeNull();
		expect(parsed.infoHash).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
	});

	test("buildMagnetUri creates valid magnet with tracker", () => {
		const uri = buildMagnetUri(
			"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
			"Test File",
			"http://proxy.example.com/api/announce?info_hash_hex=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
		);

		expect(uri).toContain("magnet:?xt=urn:btih:");
		expect(uri).toContain("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
		expect(uri).toContain("dn=Test%20File");
		expect(uri).toContain("tr=");
		expect(uri).toContain("info_hash_hex");
	});

	test("torrent file with metadata returns torrent, not magnet", async () => {
		const infoDict = {
			name: "video.mkv",
			"piece length": 262144,
			pieces: new Uint8Array(20),
			length: 500000,
		};
		const torrentBuf = bencode.encode({
			info: infoDict,
			announce: "http://tracker.example.com/announce",
		});

		const parsed = await parseMagnetOrTorrent(torrentBuf);

		// Has infoBuffer → should produce torrent file
		expect(parsed.infoBuffer).toBeTruthy();
		const torrentFile = createPrivateTorrent(parsed, announceUrl);
		expect(torrentFile.length).toBeGreaterThan(0);

		// Verify it's valid bencode with info dict
		const decoded = bencode.decode(torrentFile) as Record<string, unknown>;
		expect(decoded.info).toBeTruthy();
	});

	test("magnet without name still builds valid URI", () => {
		const uri = buildMagnetUri(
			"abcdef1234567890abcdef1234567890abcdef12",
			null,
			"http://proxy.example.com/api/announce",
		);

		expect(uri).toContain(
			"xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12",
		);
		expect(uri).not.toContain("dn=");
		expect(uri).toContain("tr=");
	});
});
