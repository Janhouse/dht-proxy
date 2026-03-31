declare module "bencode" {
	const bencode: {
		encode(data: unknown): Uint8Array;
		decode(buffer: Uint8Array | Buffer): unknown;
		byteLength(data: unknown): number;
		encodingLength(data: unknown): number;
	};
	export default bencode;
}

declare module "parse-torrent" {
	interface ParsedTorrent {
		infoHash: string;
		infoHashBuffer: Uint8Array;
		name?: string;
		announce?: string[];
		urlList?: string[];
		info?: Record<string, unknown>;
		infoBuffer?: Uint8Array;
		files?: Array<{
			path: string;
			name: string;
			length: number;
			offset: number;
		}>;
		length?: number;
		pieceLength?: number;
		lastPieceLength?: number;
		pieces?: string[];
		private?: boolean;
		created?: Date;
		createdBy?: string;
		comment?: string;
	}

	function parseTorrent(
		input: string | Uint8Array | Buffer,
	): Promise<ParsedTorrent>;

	export function toTorrentFile(parsed: ParsedTorrent): Uint8Array;
	export function toMagnetURI(parsed: ParsedTorrent): string;

	export default parseTorrent;
}

declare module "bittorrent-dht" {
	import { EventEmitter } from "node:events";

	interface DHTOptions {
		bootstrap?: boolean | Array<{ host: string; port: number }>;
		maxTables?: number;
		maxValues?: number;
		maxPeers?: number;
		maxAge?: number;
		host?: string;
		timeBucketOutdated?: number;
	}

	interface DHTNode {
		host: string;
		port: number;
		id?: Buffer;
	}

	class DHT extends EventEmitter {
		constructor(opts?: DHTOptions);
		nodeId: Buffer;
		nodes: unknown;
		listening: boolean;
		destroyed: boolean;

		lookup(
			infoHash: string | Buffer,
			callback?: (err: Error | null) => void,
		): () => void;

		announce(
			infoHash: string | Buffer,
			port: number,
			callback?: (err: Error | null, numResponses?: number) => void,
		): void;

		listen(port?: number, address?: string, onlistening?: () => void): void;

		address(): { port: number; address: string };
		destroy(callback?: () => void): void;
		toJSON(): { nodes: Array<{ host: string; port: number }> };

		on(event: "listening", listener: () => void): this;
		on(
			event: "peer",
			listener: (
				peer: { host: string; port: number },
				infoHash: Buffer,
				from: DHTNode,
			) => void,
		): this;
		on(event: "node", listener: (node: DHTNode) => void): this;
		on(event: "warning", listener: (err: Error) => void): this;
		on(event: "error", listener: (err: Error) => void): this;
		on(event: "close", listener: () => void): this;
	}

	export default DHT;
}
