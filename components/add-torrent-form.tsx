"use client";

import { LinkIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddTorrentForm() {
	const [magnet, setMagnet] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	async function handleMagnetSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!magnet.trim()) return;

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const res = await fetch("/api/add", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ magnet: magnet.trim() }),
			});

			if (!res.ok) {
				const body = await res.json();
				setError(body.error || "Failed to add torrent");
				return;
			}

			const proxyType = res.headers.get("x-dht-proxy-type");

			if (proxyType === "magnet") {
				const data = await res.json();
				await navigator.clipboard.writeText(data.magnet);
				setSuccess("Proxied magnet URI copied to clipboard");
			} else {
				const blob = await res.blob();
				const disposition = res.headers.get("content-disposition");
				const filename =
					disposition?.match(/filename="(.+)"/)?.[1] || "proxy.torrent";

				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				a.click();
				URL.revokeObjectURL(url);
				setSuccess("Proxied .torrent file downloaded");
			}

			setMagnet("");
		} catch {
			setError("Network error");
		} finally {
			setLoading(false);
			setTimeout(() => setSuccess(null), 3000);
		}
	}

	async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const formData = new FormData();
			formData.append("torrent", file);

			const res = await fetch("/api/add", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				const body = await res.json();
				setError(body.error || "Failed to add torrent");
				return;
			}

			const blob = await res.blob();
			const disposition = res.headers.get("content-disposition");
			const filename =
				disposition?.match(/filename="(.+)"/)?.[1] || "proxy.torrent";

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
			setSuccess("Proxied .torrent file downloaded");
		} catch {
			setError("Network error");
		} finally {
			setLoading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			setTimeout(() => setSuccess(null), 3000);
		}
	}

	return (
		<Card className="w-full max-w-lg shadow-xl shadow-primary/10 border-border/50 bg-card/80 backdrop-blur-md transition-all hover:shadow-2xl hover:shadow-primary/15 hover:border-primary/30">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2">
					<LinkIcon className="size-5 text-primary" />
					Add Torrent
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				<form onSubmit={handleMagnetSubmit} className="space-y-3">
					<div className="space-y-2">
						<Label htmlFor="magnet">Magnet Link</Label>
						<div className="relative">
							<Input
								id="magnet"
								placeholder="magnet:?xt=urn:btih:..."
								value={magnet}
								onChange={(e) => setMagnet(e.target.value)}
								disabled={loading}
								className="pr-4 transition-shadow focus:shadow-md focus:shadow-primary/10"
							/>
						</div>
					</div>
					<Button
						type="submit"
						disabled={loading || !magnet.trim()}
						className="w-full transition-transform active:scale-[0.98]"
					>
						{loading ? (
							<span className="flex items-center gap-2">
								<span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Processing...
							</span>
						) : (
							"Get Proxied Torrent"
						)}
					</Button>
				</form>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-card px-2 text-muted-foreground">or</span>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="torrent-file">Upload .torrent file</Label>
					<button
						type="button"
						className="group relative flex w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
						onClick={() => fileInputRef.current?.click()}
					>
						<div className="flex flex-col items-center gap-2 text-center">
							<UploadIcon className="size-8 text-muted-foreground/50 transition-colors group-hover:text-primary/70" />
							<p className="text-sm text-muted-foreground">
								Click to upload or drag and drop
							</p>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							accept=".torrent"
							onChange={handleFileUpload}
							disabled={loading}
							className="hidden"
						/>
					</button>
				</div>

				{error && (
					<div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</div>
				)}

				{success && (
					<div className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
						{success}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
