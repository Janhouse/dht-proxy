"use client";

import { useEffect } from "react";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
	useEffect(() => {
		signIn.oauth2({
			providerId: "authentik",
			callbackURL: "/admin",
		});
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-muted-foreground">Redirecting to login...</p>
		</div>
	);
}
