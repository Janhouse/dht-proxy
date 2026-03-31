"use client";

import {
	GaugeIcon,
	HardDriveIcon,
	LogOutIcon,
	MonitorIcon,
	MoonIcon,
	NetworkIcon,
	SettingsIcon,
	SunIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
	{ title: "Dashboard", href: "/admin", icon: GaugeIcon },
	{ title: "Torrents", href: "/admin/torrents", icon: HardDriveIcon },
	{ title: "Settings", href: "/admin/settings", icon: SettingsIcon },
];

const MENU_BTN =
	"flex items-center gap-2.5 h-auto py-3 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:[&>[data-label]]:hidden group-data-[collapsible=icon]:[&>svg]:size-6";

function useSmartTheme() {
	const { theme, setTheme, systemTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (mounted && theme !== "system" && theme === systemTheme) {
			setTheme("system");
		}
	}, [mounted, theme, systemTheme, setTheme]);

	const resolvedTheme = theme === "system" ? systemTheme : theme;

	const cycleTheme = useCallback(() => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	const icon = !mounted
		? MonitorIcon
		: resolvedTheme === "dark"
			? SunIcon
			: MoonIcon;

	const label = !mounted
		? "Theme"
		: resolvedTheme === "dark"
			? "Light"
			: "Dark";

	return { cycleTheme, icon, label, mounted };
}

export function AppSidebar({
	user,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: { name: string; email: string };
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { isMobile, setOpenMobile, setOpen } = useSidebar();
	const smartTheme = useSmartTheme();

	// Auto-collapse only when viewport crosses below 1024px (resize event)
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 1023px)");
		const handler = (e: MediaQueryListEvent) => {
			if (e.matches) setOpen(false);
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [setOpen]);

	const handleNavClick = useCallback(() => {
		if (isMobile) setOpenMobile(false);
	}, [isMobile, setOpenMobile]);

	async function handleSignOut() {
		await fetch("/api/auth/sign-out", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		router.push("/");
		router.refresh();
	}

	const ThemeIcon = smartTheme.icon;

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="pt-3 pb-1">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={<Link href="/" />}
							tooltip="DHT Proxy"
							className="flex items-center gap-2.5 h-auto py-3 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:px-0"
						>
							<NetworkIcon
								className="size-5 shrink-0 text-primary group-data-[collapsible=icon]:size-6"
								style={{ filter: "drop-shadow(0 0 6px var(--primary))" }}
							/>
							<span className="text-sm font-semibold leading-none group-data-[collapsible=icon]:hidden">
								DHT Proxy
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="px-1.5 group-data-[collapsible=icon]:px-1.5">
					<SidebarGroupContent>
						<SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-3">
							{navItems.map((item) => {
								const active =
									item.href === "/admin"
										? pathname === "/admin"
										: pathname.startsWith(item.href);
								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											render={
												<Link href={item.href} onClick={handleNavClick} />
											}
											isActive={active}
											tooltip={item.title}
											className={MENU_BTN}
										>
											<item.icon className="size-4" />
											<span data-label className="text-sm leading-none">
												{item.title}
											</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="px-1.5 pb-3 group-data-[collapsible=icon]:px-1.5">
				<SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-3">
					<SidebarMenuItem>
						<SidebarMenuButton
							onClick={smartTheme.cycleTheme}
							tooltip={smartTheme.label}
							className={MENU_BTN}
						>
							<ThemeIcon className="size-4" />
							<span data-label className="text-sm leading-none">
								{smartTheme.label}
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip={user.email} className={MENU_BTN}>
							<Avatar className="size-4 shrink-0 group-data-[collapsible=icon]:size-6">
								<AvatarFallback className="text-[8px]">
									{user.name
										?.split(" ")
										.map((n) => n[0])
										.join("")
										.toUpperCase() || user.email[0].toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span data-label className="text-sm leading-none truncate">
								{user.name?.split(" ")[0] || user.email.split("@")[0]}
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							onClick={handleSignOut}
							tooltip="Sign out"
							className={MENU_BTN}
						>
							<LogOutIcon className="size-4" />
							<span data-label className="text-sm leading-none">
								Sign out
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
