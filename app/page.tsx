import { NetworkIcon, ShieldIcon, ZapIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { AddTorrentForm } from "@/components/add-torrent-form";
import { MeshBackground } from "@/components/mesh-background";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
	const isPublic = process.env.DHT_PROXY_PUBLIC !== "false";
	let isLoggedIn = isPublic;

	if (!isPublic) {
		const session = await auth.api.getSession({
			headers: await headers(),
		});
		isLoggedIn = !!session;
	}

	return (
		<div className="flex min-h-svh flex-col relative overflow-hidden">
			<MeshBackground />

			<main className="flex flex-1 flex-col items-center justify-center p-4 py-16">
				<div className="mx-auto max-w-2xl space-y-10">
					<div className="space-y-5 text-center">
						<div className="flex justify-center">
							<NetworkIcon
								className="size-14 text-primary"
								style={{ filter: "drop-shadow(0 0 20px var(--primary))" }}
							/>
						</div>
						<h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
							DHT Proxy
						</h1>
						<p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
							Privacy-preserving BitTorrent peer relay. Your IP stays hidden
							from the public DHT and trackers.
						</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						{[
							{
								icon: ShieldIcon,
								title: "Private",
								desc: "Your IP is never exposed to the public DHT or trackers",
								color: "text-emerald-500",
								glow: "group-hover:shadow-emerald-500/20",
							},
							{
								icon: ZapIcon,
								title: "Fast",
								desc: "DHT and tracker queries run in parallel with geo-sorting",
								color: "text-amber-500",
								glow: "group-hover:shadow-amber-500/20",
							},
							{
								icon: NetworkIcon,
								title: "Simple",
								desc: "Just paste a magnet link or upload a .torrent file",
								color: "text-sky-500",
								glow: "group-hover:shadow-sky-500/20",
							},
						].map((item) => (
							<div
								key={item.title}
								className={`group flex flex-col items-center gap-2.5 rounded-xl border border-border/50 bg-card/30 backdrop-blur-md p-5 text-center transition-all duration-300 hover:shadow-lg ${item.glow} hover:-translate-y-1 hover:border-border`}
							>
								<item.icon
									className={`size-7 ${item.color} transition-transform group-hover:scale-110`}
								/>
								<h3 className="font-semibold text-base">{item.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{item.desc}
								</p>
							</div>
						))}
					</div>

					<div className="flex justify-center">
						{isLoggedIn ? (
							<AddTorrentForm />
						) : (
							<div className="w-full max-w-lg rounded-xl border border-border/50 bg-card/80 backdrop-blur-md p-8 text-center space-y-4">
								<p className="text-muted-foreground">
									This instance requires authentication to add torrents.
								</p>
								<div className="flex flex-col gap-2 items-center">
									<Link
										href="/login"
										className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
									>
										Sign in to continue
									</Link>
									<p className="text-xs text-muted-foreground">
										Or use an API token via{" "}
										<code className="rounded bg-muted px-1 py-0.5">
											Authorization: Bearer &lt;token&gt;
										</code>
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>

			{/* Footer with admin link */}
			<footer className="border-t border-border/50 backdrop-blur-sm">
				<div className="container mx-auto flex items-center justify-between px-4 py-4">
					<p className="text-sm text-muted-foreground">
						Made with{" "}
						<span className="inline-block animate-pulse text-red-500">
							&#10084;&#65039;
						</span>{" "}
						from community
					</p>
					<Link
						href="/admin"
						className="inline-flex h-8 items-center justify-center rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
					>
						Admin Panel
					</Link>
				</div>
			</footer>
		</div>
	);
}
