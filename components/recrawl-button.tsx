"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RecrawlButton({ torrentId }: { torrentId: string }) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	async function handleRecrawl() {
		setLoading(true);
		try {
			await fetch(`/api/torrents/${torrentId}/recrawl`, {
				method: "POST",
			});
			router.refresh();
		} finally {
			setLoading(false);
		}
	}

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleRecrawl}
			disabled={loading}
		>
			<RefreshCwIcon className={loading ? "animate-spin" : ""} />
			<span>{loading ? "Crawling..." : "Re-crawl"}</span>
		</Button>
	);
}
