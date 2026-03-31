import { Reader, type ReaderModel } from "@maxmind/geoip2-node";

declare global {
	var __geoipReader: Promise<ReaderModel> | undefined;
	var __geoipWarned: boolean | undefined;
}

function getReader(): Promise<ReaderModel> | null {
	const dbPath = process.env.GEOIP_DB_PATH;
	if (!dbPath) {
		if (!globalThis.__geoipWarned) {
			console.warn("[GeoIP] GEOIP_DB_PATH not set, geo lookups disabled");
			globalThis.__geoipWarned = true;
		}
		return null;
	}

	if (globalThis.__geoipReader) return globalThis.__geoipReader;
	console.log(`[GeoIP] Loading database from ${dbPath}`);
	globalThis.__geoipReader = Reader.open(dbPath).catch((err) => {
		console.error(`[GeoIP] Failed to open ${dbPath}:`, err);
		return null as unknown as ReaderModel;
	});
	return globalThis.__geoipReader;
}

export interface GeoIpInfo {
	countryCode: string;
	countryName: string;
	lat: number | null;
	lon: number | null;
}

const PRIVATE_IP_RANGES = [
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^169\.254\./,
	/^0\./,
	/^255\.255\.255\.255$/,
	/^::1$/,
	/^fc00:/,
	/^fe80:/,
];

function isPrivateIp(ip: string): boolean {
	return PRIVATE_IP_RANGES.some((r) => r.test(ip));
}

export async function getIpCityInfo(
	ip: string | undefined,
): Promise<GeoIpInfo | null> {
	if (!ip || isPrivateIp(ip)) return null;

	const readerPromise = getReader();
	if (!readerPromise) return null;

	try {
		const reader = await readerPromise;
		const city = reader.city(ip);
		const country = city.country;
		const location = city.location;

		if (!country?.isoCode) return null;

		return {
			countryCode: country.isoCode,
			countryName: country.names?.en || country.isoCode,
			lat: location?.latitude ?? null,
			lon: location?.longitude ?? null,
		};
	} catch {
		return null;
	}
}
