import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/stats-service";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
	const stats = await getDashboardStats();

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Dashboard</h1>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Torrents
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.totalTorrents}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Active Torrents
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.activeTorrents}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Discovered Peers
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{stats.totalPeers}</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
