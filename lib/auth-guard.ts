import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * Get the current session. Returns null if not authenticated.
 */
export async function getSession() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	return session;
}

/**
 * Require authentication. Returns the session or throws a Response.
 */
export async function requireAuth() {
	const session = await getSession();
	if (!session) {
		throw new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	return session;
}
