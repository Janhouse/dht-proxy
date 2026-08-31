import {
	createLocalAccountIssuer,
	createOAuthAccountIssuer,
} from "@better-auth/core/db";

/**
 * Issuer namespace Better Auth pairs with a provider account id.
 *
 * Better Auth 1.7 keys `accounts` on (issuer, accountId) instead of providerId.
 * Rows written before 1.7 have no issuer, so the migration backfills them with
 * this exact value, and `lib/auth.ts` pins the same one as `accountIssuer`.
 *
 * The pin matters: this is a discovery provider, so the default issuer is
 * whatever the discovery document publishes — which pre-1.7 rows never stored
 * and which changes if Authentik moves host or tenant. Either way the existing
 * linked account would stop resolving and the user would land in a new, empty
 * one. Both values come from Better Auth's own helpers so the format stays
 * pinned to the library.
 */
export function accountIssuerFor(providerId: string): string {
	return createOAuthAccountIssuer(providerId);
}

/** Issuer namespace Better Auth uses for email/password ("credential") rows. */
export const CREDENTIAL_ISSUER = createLocalAccountIssuer("credential");
