-- Hand-edited: drizzle emits a bare `ADD COLUMN "issuer" text NOT NULL`, which
-- aborts on a populated "accounts" table. Better Auth 1.7 keys provider accounts
-- on (issuer, account_id); rows written before 1.7 have no issuer, so add the
-- column nullable, backfill the synthetic namespaces Better Auth's own upgrade
-- derives, and only then enforce NOT NULL.
--
-- 'local:oauth:' || provider_id must stay in step with accountIssuerFor() in
-- lib/auth-issuer.ts, which lib/auth.ts pins as the provider's `accountIssuer`.
-- If they drift, the already-linked SSO account stops resolving.
ALTER TABLE "accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = CASE
	WHEN "provider_id" = 'credential' THEN 'local:credential'
	ELSE 'local:oauth:' || "provider_id"
END WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "issuer_accountId_idx" ON "accounts" USING btree ("issuer","account_id");
