import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeHeapSnapshot } from "node:v8";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
	await requireAuth();

	// Write to temp directory to avoid permission issues in containers
	const filePath = writeHeapSnapshot(
		join(tmpdir(), `heap-${Date.now()}.heapsnapshot`),
	);

	const file = Bun.file(filePath);
	const blob = await file.arrayBuffer();

	// Clean up the temp file
	try {
		unlinkSync(filePath);
	} catch {
		// ignore cleanup errors
	}

	return new Response(blob, {
		headers: {
			"Content-Type": "application/octet-stream",
			"Content-Disposition": `attachment; filename="heap-${Date.now()}.heapsnapshot"`,
		},
	});
}
