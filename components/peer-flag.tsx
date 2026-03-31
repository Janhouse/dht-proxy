"use client";

import ReactCountryFlag from "react-country-flag";

export function PeerFlag({
	countryCode,
	countryName,
}: {
	countryCode?: string;
	countryName?: string;
}) {
	if (!countryCode) {
		return <span className="text-muted-foreground text-xs">-</span>;
	}

	return (
		<ReactCountryFlag
			svg
			countryCode={countryCode}
			aria-label={countryName || countryCode}
			title={countryName || countryCode}
			style={{ width: "1.2em", height: "1.2em" }}
		/>
	);
}
