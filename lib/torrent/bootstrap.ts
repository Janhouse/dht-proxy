import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { torrents } from "../db/schema";
import {
	crawlAllTorrents,
	ensureDhtNode,
	persistDhtNodes,
	startBackgroundJobs,
} from "./dht-crawler";

export async function bootstrap() {
	// Run database migrations
	try {
		await migrate(db, {
			migrationsFolder: join(process.cwd(), "drizzle"),
		});
		console.log("[Instrumentation] Database migrations applied");
	} catch (err) {
		console.error("[Instrumentation] Migration failed:", err);
	}

	// Start background job intervals (crawl + cleanup timers)
	startBackgroundJobs();

	// Only bootstrap the DHT node if there are active torrents
	const activeTorrents = await db
		.select({ id: torrents.id })
		.from(torrents)
		.where(eq(torrents.isActive, true))
		.limit(1);

	if (activeTorrents.length > 0) {
		const dht = ensureDhtNode();
		dht.on("listening", () => {
			console.log("[Instrumentation] DHT node ready");
			setTimeout(() => {
				crawlAllTorrents().catch(console.error);
			}, 10_000);
		});
	} else {
		console.log(
			"[Instrumentation] No active torrents — DHT node deferred until needed",
		);
	}

	const shutdown = () => {
		console.log("[Instrumentation] Shutting down, persisting DHT nodes...");
		persistDhtNodes();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
