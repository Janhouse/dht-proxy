import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import {
	crawlAllTorrents,
	getDhtNode,
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

	const dht = getDhtNode();

	dht.on("listening", () => {
		console.log("[Instrumentation] DHT node ready");
		startBackgroundJobs();

		setTimeout(() => {
			crawlAllTorrents().catch(console.error);
		}, 10_000);
	});

	const shutdown = () => {
		console.log("[Instrumentation] Shutting down, persisting DHT nodes...");
		persistDhtNodes();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
