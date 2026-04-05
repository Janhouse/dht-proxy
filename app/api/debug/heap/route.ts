import { unlinkSync } from "node:fs";
import { writeHeapSnapshot } from "node:v8";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
	await requireAuth();

	// writeHeapSnapshot generates a .heapsnapshot file loadable in Chrome DevTools
	const filePath = writeHeapSnapshot();

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
