import bencode from "bencode";
import parseTorrent from "parse-torrent";

export interface ParsedTorrent {
	infoHash: string;
	name: string | null;
	announce: string[];
	files: Array<{ path: string; name: string; length: number }>;
	length: number | null;
	pieceLength: number | null;
	private: boolean;
	infoBuffer: Uint8Array | null;
}

/**
 * Parse a magnet URI or .torrent file buffer into a normalized object.
 */
export async function parseMagnetOrTorrent(
	input: string | Uint8Array,
): Promise<ParsedTorrent> {
	const parsed = await parseTorrent(input);

	return {
		infoHash: parsed.infoHash,
		name: parsed.name || null,
		announce: parsed.announce || [],
		files: (parsed.files || []).map(
			(f: { path: string; name: string; length: number }) => ({
				path: f.path,
				name: f.name,
				length: f.length,
			}),
		),
		length: parsed.length || null,
		pieceLength: parsed.pieceLength || null,
		private: parsed.private || false,
		infoBuffer: parsed.infoBuffer || null,
	};
}

/**
 * Create a .torrent file buffer with our announce URL.
 * If we have the original torrent info (from a .torrent file upload),
 * we rewrite the announce URL. For magnet-only, we create a minimal torrent.
 */
export function createPrivateTorrent(
	parsed: ParsedTorrent,
	announceUrl: string,
): Uint8Array {
	// Append info_hash_hex to the announce URL so we can identify the torrent
	// without relying on binary info_hash parsing (which Next.js mangles via UTF-8)
	const separator = announceUrl.includes("?") ? "&" : "?";
	const fullAnnounceUrl = `${announceUrl}${separator}info_hash_hex=${parsed.infoHash}`;

	if (parsed.infoBuffer) {
		// We have full torrent metadata — rewrite announce URL
		const info = bencode.decode(parsed.infoBuffer);
		const torrentDict: Record<string, unknown> = {
			info,
			announce: fullAnnounceUrl,
		};

		return bencode.encode(torrentDict);
	}

	// Magnet-only: create a minimal torrent structure
	const infoHashBuffer = hexToBuffer(parsed.infoHash);

	const torrentDict: Record<string, unknown> = {
		"magnet-info": {
			info_hash: infoHashBuffer,
			"display-name": parsed.name || parsed.infoHash,
		},
		announce: fullAnnounceUrl,
	};

	return bencode.encode(torrentDict);
}

/**
 * Build a magnet URI from parsed torrent data with our announce URL.
 */
export function buildMagnetUri(
	infoHash: string,
	name: string | null,
	announceUrl: string,
): string {
	let uri = `magnet:?xt=urn:btih:${infoHash}`;
	if (name) {
		uri += `&dn=${encodeURIComponent(name)}`;
	}
	uri += `&tr=${encodeURIComponent(announceUrl)}`;
	return uri;
}

/**
 * Encode a bencoded compact peer list for BT tracker announce responses.
 * Each peer is encoded as 6 bytes: 4 bytes IP + 2 bytes port.
 */
export function encodeCompactPeers(
	peers: Array<{ ip: string; port: number }>,
): Uint8Array {
	const buffer = new Uint8Array(peers.length * 6);
	for (let i = 0; i < peers.length; i++) {
		const parts = peers[i].ip.split(".");
		buffer[i * 6] = Number.parseInt(parts[0], 10);
		buffer[i * 6 + 1] = Number.parseInt(parts[1], 10);
		buffer[i * 6 + 2] = Number.parseInt(parts[2], 10);
		buffer[i * 6 + 3] = Number.parseInt(parts[3], 10);
		buffer[i * 6 + 4] = (peers[i].port >> 8) & 0xff;
		buffer[i * 6 + 5] = peers[i].port & 0xff;
	}
	return buffer;
}

/**
 * Build a bencoded tracker announce response.
 */
export function buildAnnounceResponse(
	peers: Array<{ ip: string; port: number }>,
	interval = 1800,
): Uint8Array {
	const compactPeers = encodeCompactPeers(peers);
	return bencode.encode({
		interval,
		complete: 0,
		incomplete: peers.length,
		peers: compactPeers,
	});
}

/**
 * Parse info_hash from a tracker announce request query string.
 * The info_hash comes URL-encoded as raw bytes.
 */
export function parseInfoHashFromQuery(rawInfoHash: string): string | null {
	try {
		// info_hash can be URL-encoded binary (20 bytes) or hex string (40 chars)
		if (rawInfoHash.length === 40 && /^[0-9a-fA-F]+$/.test(rawInfoHash)) {
			return rawInfoHash.toLowerCase();
		}

		// URL-encoded binary — decode to hex
		const bytes = new Uint8Array(20);
		let byteIndex = 0;
		for (let i = 0; i < rawInfoHash.length && byteIndex < 20; i++) {
			if (rawInfoHash[i] === "%") {
				bytes[byteIndex++] = Number.parseInt(
					rawInfoHash.substring(i + 1, i + 3),
					16,
				);
				i += 2;
			} else {
				bytes[byteIndex++] = rawInfoHash.charCodeAt(i);
			}
		}

		if (byteIndex === 20) {
			return bufferToHex(bytes);
		}

		return null;
	} catch {
		return null;
	}
}

function hexToBuffer(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
