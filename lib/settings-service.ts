import { db } from "./db";
import { settings } from "./db/schema";

const ALLOWED_SETTINGS = new Set(["ttl_days"]);

export function isAllowedSetting(key: string): boolean {
	return ALLOWED_SETTINGS.has(key);
}

export async function getAllSettings(): Promise<Record<string, string>> {
	const rows = await db.select().from(settings);
	const map: Record<string, string> = {};
	for (const s of rows) {
		map[s.key] = s.value;
	}
	// Include server-side config that the UI needs to display
	map.announce_url =
		process.env.ANNOUNCE_URL || "http://localhost:3000/api/announce";
	return map;
}

export async function updateSettings(
	values: Record<string, string>,
): Promise<void> {
	const now = new Date();
	for (const [key, value] of Object.entries(values)) {
		await db
			.insert(settings)
			.values({ key, value: String(value), updatedAt: now })
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: String(value), updatedAt: now },
			});
	}
}
