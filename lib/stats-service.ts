import { count, eq } from "drizzle-orm";
import { db } from "./db";
import { peers, torrents } from "./db/schema";

export interface DashboardStats {
	totalTorrents: number;
	activeTorrents: number;
	totalPeers: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
	const [[torrentStats], [activeStats], [peerStats]] = await Promise.all([
		db.select({ total: count() }).from(torrents),
		db
			.select({ total: count() })
			.from(torrents)
			.where(eq(torrents.isActive, true)),
		db.select({ total: count() }).from(peers),
	]);

	return {
		totalTorrents: torrentStats.total,
		activeTorrents: activeStats.total,
		totalPeers: peerStats.total,
	};
}
