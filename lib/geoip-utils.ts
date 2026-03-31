import type { GeoIpInfo } from "./geoip";

export const RIGA_COORDS = { lat: 56.9496, lon: 24.1052 };

/**
 * Haversine distance between two lat/lon points in kilometers.
 */
export function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

export interface PeerWithGeo {
	ip: string;
	port: number;
	source: string;
	discoveredAt: Date;
	lastSeenAt: Date;
	geo: GeoIpInfo | null;
	distanceKm: number | null;
}

/**
 * Annotate peers with geo info and sort by distance from user.
 */
export function sortPeersByDistance(
	peers: Array<{
		ip: string;
		port: number;
		source: string;
		discoveredAt: Date;
		lastSeenAt: Date;
	}>,
	geoMap: Map<string, GeoIpInfo | null>,
	userLat: number,
	userLon: number,
): PeerWithGeo[] {
	const annotated: PeerWithGeo[] = peers.map((p) => {
		const geo = geoMap.get(p.ip) ?? null;
		const distanceKm =
			geo?.lat != null && geo?.lon != null
				? Math.round(haversineDistance(userLat, userLon, geo.lat, geo.lon))
				: null;
		return { ...p, geo, distanceKm };
	});

	annotated.sort((a, b) => {
		if (a.distanceKm === null && b.distanceKm === null) return 0;
		if (a.distanceKm === null) return 1;
		if (b.distanceKm === null) return -1;
		return a.distanceKm - b.distanceKm;
	});

	return annotated;
}
