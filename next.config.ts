import type { NextConfig } from "next";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  media-src 'none';
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\n/g, "");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: ContentSecurityPolicy },
	{ key: "Referrer-Policy", value: "origin-when-cross-origin" },
	{ key: "X-Frame-Options", value: "SAMEORIGIN" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{
		key: "Strict-Transport-Security",
		value: "max-age=31536000; includeSubDomains; preload",
	},
	{
		key: "Permissions-Policy",
		value:
			"camera=(), microphone=(), geolocation=(), payment=(), display-capture=(), usb=()",
	},
];

const nextConfig: NextConfig = {
	output: "standalone",
	serverExternalPackages: [
		"bittorrent-dht",
		"parse-torrent",
		"bencode",
		"@maxmind/geoip2-node",
	],
	reactCompiler: true,
	reactStrictMode: false, // true to test hooks
	headers() {
		return [{ source: "/(.*)", headers: securityHeaders }];
	},
	generateBuildId: async () => {
		// Get tag of current branch(that is HEAD) or fallback to short commit hash (7 digits)
		return require("node:child_process")
			.execSync(
				`git describe --exact-match --tags 2> /dev/null || git rev-parse --short HEAD`,
			)
			.toString()
			.trim();
	},
};

export default nextConfig;
