import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Better Auth recognises a linked account by (providerId, accountId) — its
 * exported `AccountKey` type, which `findAccountOwnerByKey` queries on. 1.7.0
 * briefly keyed on (issuer, accountId) and this app followed it; 1.7.3 dropped
 * the issuer concept and migration 0006 drops the column.
 *
 * Both halves of that are silent when they drift: an accounts row Better Auth
 * can no longer key on doesn't error, it just fails to resolve and the user
 * lands in a new, empty account. So they are pinned here.
 */

const readMigration = (file: string) =>
	readFileSync(path.resolve(import.meta.dir, "../../drizzle", file), "utf8")
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n");

describe("account key", () => {
	it("keys accounts on providerId and accountId", async () => {
		const { accounts } = await import("../db/schema");
		expect(Object.keys(accounts)).toContain("providerId");
		expect(Object.keys(accounts)).toContain("accountId");
	});

	it("no longer declares the issuer Better Auth 1.7.3 removed", async () => {
		const { accounts } = await import("../db/schema");
		expect(Object.keys(accounts)).not.toContain("issuer");
	});

	it("drops both halves of 0005 in migration 0006", () => {
		const migration = readMigration("0006_drop_account_issuer.sql");
		expect(migration).toContain('DROP INDEX "issuer_accountId_idx"');
		expect(migration).toContain('DROP COLUMN "issuer"');
	});

	it("leaves provider_id intact so dropping issuer is lossless", () => {
		// 0005 added issuer alongside provider_id rather than replacing it, which
		// is the only reason 0006 can drop the column without a backfill.
		const added = readMigration("0005_acoustic_mad_thinker.sql");
		expect(added).not.toMatch(/(DROP|RENAME) COLUMN "provider_id"/);
	});

	it("registers the OIDC provider under the pinned provider id", async () => {
		const source = readFileSync(
			path.resolve(import.meta.dir, "../auth.ts"),
			"utf8",
		);
		expect(source).toContain('const OIDC_PROVIDER_ID = "authentik"');
		expect(source).toContain("providerId: OIDC_PROVIDER_ID");
	});
});
