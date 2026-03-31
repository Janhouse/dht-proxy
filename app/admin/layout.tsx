import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { SiteFooter } from "@/components/site-footer";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	const buildId = process.env.BUILD_ID;

	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get("sidebar_state");
	const sidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : false;

	return (
		<SidebarProvider
			defaultOpen={sidebarOpen}
			className="overflow-x-hidden"
			style={
				{
					"--sidebar-width": "160px",
					"--sidebar-width-icon": "54px",
				} as React.CSSProperties
			}
		>
			<AppSidebar
				user={{
					name: session.user.name,
					email: session.user.email,
				}}
			/>
			<SidebarInset className="min-w-0">
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator
							orientation="vertical"
							className="mr-2 data-vertical:h-4"
						/>
						<DynamicBreadcrumb />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-w-0 overflow-hidden">
					{children}
				</div>
				<SiteFooter buildId={buildId} />
			</SidebarInset>
		</SidebarProvider>
	);
}
