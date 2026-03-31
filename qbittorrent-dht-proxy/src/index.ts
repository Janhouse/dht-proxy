const QBITTORRENT_URL = process.env.QBITTORRENT_URL || "http://localhost:8080";
const QBITTORRENT_USERNAME = process.env.QBITTORRENT_USERNAME || "admin";
const QBITTORRENT_PASSWORD = process.env.QBITTORRENT_PASSWORD || "adminadmin";
const DHT_PROXY_URL = process.env.DHT_PROXY_URL || "http://localhost:3000";
const DHT_PROXY_API_TOKEN = process.env.DHT_PROXY_API_TOKEN || "";
const PROXY_PORT = Number.parseInt(process.env.PROXY_PORT || "9080", 10);

let qbtSidCookie = "";

/**
 * Login to qBittorrent and store the SID cookie.
 */
async function loginToQBittorrent(): Promise<void> {
	console.log(`[QB] Logging in to ${QBITTORRENT_URL}...`);

	const res = await fetch(`${QBITTORRENT_URL}/api/v2/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			username: QBITTORRENT_USERNAME,
			password: QBITTORRENT_PASSWORD,
		}),
		redirect: "manual",
	});

	const setCookie = res.headers.get("set-cookie");
	if (setCookie) {
		const sidMatch = setCookie.match(/SID=([^;]+)/);
		if (sidMatch) {
			qbtSidCookie = `SID=${sidMatch[1]}`;
			console.log("[QB] Login successful");
			return;
		}
	}

	const body = await res.text();
	if (body === "Ok.") {
		// Some versions don't set cookie on first login
		const cookieHeader = res.headers.get("set-cookie");
		if (cookieHeader) {
			qbtSidCookie = cookieHeader.split(";")[0];
		}
		console.log("[QB] Login successful (no cookie in response)");
		return;
	}

	throw new Error(`[QB] Login failed: ${body}`);
}

interface ProxiedResult {
	type: "torrent" | "magnet";
	torrentData?: Uint8Array;
	magnetUri?: string;
}

/**
 * Send a magnet or .torrent buffer to dht-proxy.
 * Returns either a proxied .torrent file or a magnet URI with our tracker.
 */
async function getProxiedTorrent(
	input: string | Uint8Array,
): Promise<ProxiedResult> {
	const headers: Record<string, string> = {};
	if (DHT_PROXY_API_TOKEN) {
		headers.Authorization = `Bearer ${DHT_PROXY_API_TOKEN}`;
	}

	let res: Response;

	if (typeof input === "string") {
		headers["Content-Type"] = "application/json";
		res = await fetch(`${DHT_PROXY_URL}/api/add`, {
			method: "POST",
			headers,
			body: JSON.stringify({ magnet: input }),
		});
	} else {
		const formData = new FormData();
		formData.append("torrent", new Blob([input.buffer]), "file.torrent");
		res = await fetch(`${DHT_PROXY_URL}/api/add`, {
			method: "POST",
			headers,
			body: formData,
		});
	}

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`DHT proxy returned ${res.status}: ${body}`);
	}

	const proxyType = res.headers.get("x-dht-proxy-type");
	const contentType = res.headers.get("content-type") || "";

	console.log(
		`[DHT] Response: status=${res.status} type=${proxyType} content-type=${contentType}`,
	);

	if (proxyType === "magnet" || contentType.includes("application/json")) {
		const json = await res.json();
		console.log(`[DHT] Got magnet URI: ${json.magnet?.substring(0, 80)}...`);
		return { type: "magnet", magnetUri: json.magnet };
	}

	const data = new Uint8Array(await res.arrayBuffer());
	console.log(`[DHT] Got .torrent file: ${data.length} bytes`);
	return { type: "torrent", torrentData: data };
}

/**
 * Forward a torrent add request to qBittorrent with proxied torrents.
 */
async function handleTorrentAdd(request: Request): Promise<Response> {
	const formData = await request.formData();

	// Extract magnets from 'urls' field (newline-separated)
	const urlsField = formData.get("urls") as string | null;
	const magnets = urlsField
		? urlsField
				.split("\n")
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
		: [];

	// Extract .torrent files from 'torrents' field
	const torrentFiles: File[] = [];
	for (const [key, value] of formData.entries()) {
		if (key === "torrents" && value instanceof File) {
			torrentFiles.push(value);
		}
	}

	console.log(
		`[Proxy] Intercepting torrent add: ${magnets.length} magnets, ${torrentFiles.length} files`,
	);

	// Get proxied results for all inputs
	const proxiedTorrents: Uint8Array[] = [];
	const proxiedMagnets: string[] = [];

	for (const magnet of magnets) {
		try {
			console.log(`[Proxy] Proxying magnet: ${magnet.substring(0, 80)}...`);
			const result = await getProxiedTorrent(magnet);
			if (result.type === "torrent" && result.torrentData) {
				proxiedTorrents.push(result.torrentData);
			} else if (result.type === "magnet" && result.magnetUri) {
				proxiedMagnets.push(result.magnetUri);
			}
		} catch (err) {
			console.error(`[Proxy] Failed to proxy magnet: ${err}`);
		}
	}

	for (const file of torrentFiles) {
		try {
			console.log(`[Proxy] Proxying torrent file: ${file.name}`);
			const buffer = new Uint8Array(await file.arrayBuffer());
			const result = await getProxiedTorrent(buffer);
			if (result.type === "torrent" && result.torrentData) {
				proxiedTorrents.push(result.torrentData);
			} else if (result.type === "magnet" && result.magnetUri) {
				proxiedMagnets.push(result.magnetUri);
			}
		} catch (err) {
			console.error(`[Proxy] Failed to proxy torrent file: ${err}`);
		}
	}

	if (proxiedTorrents.length === 0 && proxiedMagnets.length === 0) {
		return new Response("No torrents were successfully proxied", {
			status: 400,
		});
	}

	console.log(
		`[Proxy] Forwarding to qBT: ${proxiedTorrents.length} .torrent files, ${proxiedMagnets.length} magnets`,
	);

	// Build new form data for qBittorrent
	const qbtFormData = new FormData();

	// Copy all non-torrent fields (savepath, category, tags, etc.)
	for (const [key, value] of formData.entries()) {
		if (key !== "urls" && key !== "torrents") {
			qbtFormData.append(key, value);
		}
	}

	// Add proxied magnet URIs
	if (proxiedMagnets.length > 0) {
		qbtFormData.append("urls", proxiedMagnets.join("\n"));
	}

	// Add proxied .torrent files
	for (let i = 0; i < proxiedTorrents.length; i++) {
		qbtFormData.append(
			"torrents",
			new Blob([proxiedTorrents[i].buffer], {
				type: "application/x-bittorrent",
			}),
			`proxied-${i}.torrent`,
		);
	}

	// Forward to qBittorrent
	const qbtRes = await fetch(`${QBITTORRENT_URL}/api/v2/torrents/add`, {
		method: "POST",
		headers: {
			Cookie: qbtSidCookie,
			Referer: QBITTORRENT_URL,
		},
		body: qbtFormData,
	});

	// If auth expired, re-login and retry once
	if (qbtRes.status === 403) {
		console.log("[Proxy] qBittorrent session expired, re-logging in...");
		await loginToQBittorrent();

		const retryRes = await fetch(`${QBITTORRENT_URL}/api/v2/torrents/add`, {
			method: "POST",
			headers: {
				Cookie: qbtSidCookie,
				Referer: QBITTORRENT_URL,
			},
			body: qbtFormData,
		});

		return new Response(retryRes.body, {
			status: retryRes.status,
			headers: retryRes.headers,
		});
	}

	return new Response(qbtRes.body, {
		status: qbtRes.status,
		headers: qbtRes.headers,
	});
}

/**
 * Proxy any other request to qBittorrent as-is.
 */
async function proxyToQBittorrent(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const targetUrl = `${QBITTORRENT_URL}${url.pathname}${url.search}`;

	const headers = new Headers(request.headers);
	// Use client's own cookie if present, otherwise use our pre-authenticated SID
	if (!headers.get("cookie") && qbtSidCookie) {
		headers.set("Cookie", qbtSidCookie);
	}
	headers.set("Referer", QBITTORRENT_URL);
	headers.delete("host");
	// Request uncompressed responses to avoid encoding issues with downstream clients
	headers.set("Accept-Encoding", "identity");

	const res = await fetch(targetUrl, {
		method: request.method,
		headers,
		body:
			request.method !== "GET" && request.method !== "HEAD"
				? request.body
				: undefined,
		redirect: "manual",
	});

	// If auth expired, re-login and retry once
	if (res.status === 403 && url.pathname !== "/api/v2/auth/login") {
		await loginToQBittorrent();
		headers.set("Cookie", qbtSidCookie);

		const retryRes = await fetch(targetUrl, {
			method: request.method,
			headers,
			body:
				request.method !== "GET" && request.method !== "HEAD"
					? request.body
					: undefined,
			redirect: "manual",
		});

		return new Response(retryRes.body, {
			status: retryRes.status,
			headers: retryRes.headers,
		});
	}

	return new Response(res.body, {
		status: res.status,
		headers: res.headers,
	});
}

// Start server with retry loop
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start() {
	// Wait 1s before starting to avoid tight restart loops in Docker
	await sleep(1000);

	while (true) {
		try {
			await loginToQBittorrent();
			break;
		} catch (err) {
			console.error(`[Proxy] ${err}`);
			console.log("[Proxy] Retrying in 5s...");
			await sleep(5000);
		}
	}

	const server = Bun.serve({
		port: PROXY_PORT,
		async fetch(request: Request, server): Promise<Response> {
			const url = new URL(request.url);
			const clientIp = server.requestIP(request)?.address || "unknown";
			const start = Date.now();

			console.log(
				`[${clientIp}] --> ${request.method} ${url.pathname}${url.search}`,
			);

			let response: Response;

			if (
				request.method === "POST" &&
				url.pathname === "/api/v2/torrents/add"
			) {
				response = await handleTorrentAdd(request);
			} else {
				response = await proxyToQBittorrent(request);
			}

			console.log(
				`[${clientIp}] <-- ${request.method} ${url.pathname} ${response.status} ${Date.now() - start}ms`,
			);

			return response;
		},
	});

	console.log(
		`[Proxy] qBittorrent DHT Proxy listening on http://localhost:${server.port}`,
	);
	console.log(`[Proxy] qBittorrent: ${QBITTORRENT_URL}`);
	console.log(`[Proxy] DHT Proxy: ${DHT_PROXY_URL}`);
}

start().catch((err) => {
	console.error("[Proxy] Fatal error:", err);
	process.exit(1);
});
