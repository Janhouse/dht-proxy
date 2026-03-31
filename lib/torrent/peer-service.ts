import { count as dbCount, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { peers } from "../db/schema";

const DEFAULT_LIMIT = 50;

export interface PaginatedPeersResult {
	peers: Array<{
		ip: string;
		port: number;
		sources: string[];
		countryCode: string | null;
		countryName: string | null;
		lat: number | null;
		lon: number | null;
		lastSeenAt: Date;
	}>;
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

export interface PeerQueryParams {
	page: number;
	limit: number;
	userLat: number | null;
	userLon: number | null;
}

export function parsePeerQueryParams(
	searchParams: URLSearchParams,
): PeerQueryParams {
	return {
		page: Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1),
		limit: Math.min(
			Math.max(
				Number.parseInt(searchParams.get("limit") || "", 10) || DEFAULT_LIMIT,
				1,
			),
			200,
		),
		userLat: Number.parseFloat(searchParams.get("userLat") || "") || null,
		userLon: Number.parseFloat(searchParams.get("userLon") || "") || null,
	};
}

/**
 * Get paginated peers for a torrent, merged by ip:port with combined sources.
 */
export async function getPaginatedPeers(
	torrentId: string,
	params: PeerQueryParams,
): Promise<PaginatedPeersResult> {
	const { page, limit, userLat, userLon } = params;

	const [{ total }] = await db
		.select({ total: dbCount() })
		.from(
			db
				.selectDistinct({ ip: peers.ip, port: peers.port })
				.from(peers)
				.where(eq(peers.torrentId, torrentId))
				.as("unique_peers"),
		);

	const offset = (page - 1) * limit;

	const distanceExpr =
		userLat !== null && userLon !== null
			? sql`CASE WHEN MAX(${peers.lat}) IS NOT NULL AND MAX(${peers.lon}) IS NOT NULL
				THEN (MAX(${peers.lat}) - ${userLat})^2 + (MAX(${peers.lon}) - ${userLon})^2
				ELSE 999999999
			END`
			: sql`0`;

	const rows = await db
		.select({
			ip: peers.ip,
			port: peers.port,
			sources: sql<string>`STRING_AGG(DISTINCT ${peers.source}::text, ',')`,
			countryCode: sql<string | null>`MAX(${peers.countryCode})`,
			countryName: sql<string | null>`MAX(${peers.countryName})`,
			lat: sql<number | null>`MAX(${peers.lat})`,
			lon: sql<number | null>`MAX(${peers.lon})`,
			lastSeenAt: sql<Date>`MAX(${peers.lastSeenAt})`,
		})
		.from(peers)
		.where(eq(peers.torrentId, torrentId))
		.groupBy(peers.ip, peers.port)
		.orderBy(
			userLat !== null && userLon !== null
				? sql`${distanceExpr} ASC, ${peers.ip} ASC, ${peers.port} ASC`
				: sql`MAX(${peers.lastSeenAt}) DESC, ${peers.ip} ASC, ${peers.port} ASC`,
		)
		.limit(limit)
		.offset(offset);

	return {
		peers: rows.map((r) => ({
			ip: r.ip,
			port: r.port,
			sources: (r.sources || "").split(",").filter(Boolean),
			countryCode: r.countryCode,
			countryName: r.countryName,
			lat: r.lat,
			lon: r.lon,
			lastSeenAt: r.lastSeenAt,
		})),
		total,
		page,
		limit,
		hasMore: offset + limit < total,
	};
}
