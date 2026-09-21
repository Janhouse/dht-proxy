import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";

/**
 * Provider id registered below.
 *
 * Better Auth recognises a linked account by (providerId, accountId), so this
 * value is load-bearing: change it and the existing linked SSO account stops
 * resolving and the user lands in a new, empty one.
 */
const OIDC_PROVIDER_ID = "authentik";

import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			...schema,
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
		},
	}),
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: OIDC_PROVIDER_ID,
					discoveryUrl:
						process.env.OIDC_ISSUER_URL ||
						"https://authentik.example.com/application/o/dht-proxy/",
					clientId: process.env.OIDC_CLIENT_ID || "dht-proxy",
					clientSecret: process.env.OIDC_CLIENT_SECRET || "",
					scopes: ["openid", "profile", "email"],
				},
			],
		}),
	],
});
