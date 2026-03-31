"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function DynamicBreadcrumb() {
	const pathname = usePathname();
	const segments = pathname.split("/").filter(Boolean);

	const items: Array<{ label: string; href?: string }> = [];

	// Always show "Admin" as first item linking to dashboard
	items.push({ label: "Admin", href: "/admin" });

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		if (segment === "admin") continue; // Already added above

		const href = `/${segments.slice(0, i + 1).join("/")}`;
		const isLast = i === segments.length - 1;

		const isUuid = segment.length > 20 && segment.includes("-");
		const label = isUuid
			? `${segment.substring(0, 8)}...`
			: segment.charAt(0).toUpperCase() + segment.slice(1);

		items.push(isLast ? { label } : { label, href });
	}

	// On /admin itself, show "Admin > Dashboard"
	if (segments.length === 1 && segments[0] === "admin") {
		items.push({ label: "Dashboard" });
	}

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{items.map((item, i) => (
					<Fragment key={item.label + String(i)}>
						{i > 0 && <BreadcrumbSeparator />}
						<BreadcrumbItem>
							{item.href ? (
								<BreadcrumbLink render={<Link href={item.href} />}>
									{item.label}
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage>{item.label}</BreadcrumbPage>
							)}
						</BreadcrumbItem>
					</Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
