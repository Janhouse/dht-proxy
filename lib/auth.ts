import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
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
					providerId: "authentik",
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
