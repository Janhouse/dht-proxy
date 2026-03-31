import { GitCommitHorizontalIcon } from "lucide-react";

export function SiteFooter({ buildId }: { buildId?: string }) {
	return (
		<footer className="border-t">
			<div className="container mx-auto flex items-center justify-between px-4 py-3">
				<p className="text-xs text-muted-foreground">
					Made with{" "}
					<span className="inline-block animate-pulse text-red-500">
						&#10084;&#65039;
					</span>{" "}
					from community
				</p>
				{buildId && (
					<div className="flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1 transition-all hover:bg-muted hover:scale-105">
						<GitCommitHorizontalIcon className="size-3 text-muted-foreground" />
						<span className="font-mono text-xs text-muted-foreground">
							{buildId}
						</span>
						<span className="relative flex size-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
							<span className="relative inline-flex size-2 rounded-full bg-green-500" />
						</span>
					</div>
				)}
			</div>
		</footer>
	);
}
