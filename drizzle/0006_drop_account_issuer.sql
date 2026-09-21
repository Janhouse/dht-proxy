-- Reverses 0005. Better Auth 1.7.0 keyed provider accounts on
-- (issuer, account_id); 1.7.3 reverted to (provider_id, account_id) and removed
-- the issuer concept entirely — `@better-auth/core/db` no longer has an issuer
-- field on its account schema, and exports the key it does use:
--
--   type AccountKey = Readonly<Pick<BaseAccount, "providerId" | "accountId">>
--
-- Dropping the column is lossless: 0005 only ever added issuer alongside
-- provider_id, it never rewrote or removed provider_id, so every row still
-- carries the identity Better Auth reads again now. No unique index is
-- recreated because none existed before 0005 and getAuthTables() declares only
-- a plain index on user_id for this table.
DROP INDEX "issuer_accountId_idx";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "issuer";
