"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
	const [ttlDays, setTtlDays] = useState("7");
	const [announceUrl, setAnnounceUrl] = useState("");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/settings")
			.then((res) => res.json())
			.then((data) => {
				if (data.ttl_days) setTtlDays(data.ttl_days);
				if (data.announce_url) setAnnounceUrl(data.announce_url);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	async function handleSave() {
		setSaving(true);
		setSaved(false);

		await fetch("/api/settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ttl_days: ttlDays }),
		});

		setSaving(false);
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	if (loading) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold">Settings</h1>
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Settings</h1>

			<Card className="max-w-md">
				<CardHeader>
					<CardTitle className="text-sm font-medium">Auto-Removal</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="ttl">Remove torrents after (days)</Label>
						<Input
							id="ttl"
							type="number"
							min="1"
							max="365"
							value={ttlDays}
							onChange={(e) => setTtlDays(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Torrents will be automatically removed after this many days.
							Default: 7 days.
						</p>
					</div>

					<Button onClick={handleSave} disabled={saving}>
						{saving ? "Saving..." : saved ? "Saved!" : "Save"}
					</Button>
				</CardContent>
			</Card>

			<Card className="max-w-md">
				<CardHeader>
					<CardTitle className="text-sm font-medium">Announce URL</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-mono text-sm break-all">
						{announceUrl || "Loading..."}
					</p>
					<p className="text-xs text-muted-foreground mt-2">
						This is the tracker URL embedded in generated .torrent files.
						Configure via the ANNOUNCE_URL environment variable.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
