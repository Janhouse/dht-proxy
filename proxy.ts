import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!_next/static|_next/image|favicon.ico|api/ws).*)",
	],
};

const skipMiddleware = [
	/^\/_next\//,
	/^\/static\//,
	/^\/auth\//,
	/^\/favicon.ico/,
	/^\/robots.txt/,
];

// CSRF protection using Sec-Fetch-Site header
function checkCsrf(request: NextRequest): NextResponse | null {
	const { pathname } = request.nextUrl;

	// Only protect API routes (excluding auth callbacks from OAuth providers)
	if (!pathname.startsWith("/api/") || pathname.startsWith("/api/auth/")) {
		return null;
	}

	// Only check state-changing methods
	if (!["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
		return null;
	}

	const secFetchSite = request.headers.get("sec-fetch-site");

	// Block cross-site requests
	if (secFetchSite === "cross-site") {
		return NextResponse.json(
			{ error: "Cross-site request blocked" },
			{ status: 403 },
		);
	}

	return null;
}

export async function proxy(request: NextRequest) {
	const response = NextResponse.next();
	if (skipMiddleware.find((r) => r.test(request.nextUrl.pathname))) {
		return response;
	}

	// Run CSRF check
	const csrfResponse = checkCsrf(request);
	if (csrfResponse) {
		return csrfResponse;
	}

	return response;
}
