function getBuildId() {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require("node:fs").readFileSync("./.next/BUILD_ID", "utf8").trim();
	} catch (err: unknown) {
		if (err instanceof Error && "code" in err && err.code === "ENOENT") {
			return "development";
		}
	}
}

export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	// Set build ID
	process.env.BUILD_ID = getBuildId();

	const { bootstrap } = await import("./lib/torrent/bootstrap");
	await bootstrap();
}
