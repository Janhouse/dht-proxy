import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { accountIssuerFor, CREDENTIAL_ISSUER } from "../auth-issuer";

/**
 * Better Auth 1.7 keys `accounts` on (issuer, accountId). If the issuer the
 * running app computes ever drifts from the one migration 0005 backfilled, the
 * already-linked SSO account stops resolving and the user silently lands in a
 * new, empty one — with no error anywhere. Nothing about that is visible to a
 * typecheck, so it is pinned here.
 */

const migrationFile = readFileSync(
	path.resolve(import.meta.dir, "../../drizzle/0005_acoustic_mad_thinker.sql"),
	"utf8",
);
// The header comment quotes the statement it replaced, so assert on statements.
const migration = migrationFile
	.split("\n")
	.filter((line) => !line.trimStart().startsWith("--"))
	.join("\n");

describe("account issuer", () => {
	it("matches what migration 0005 backfills for the OIDC provider", () => {
		expect(accountIssuerFor("authentik")).toBe("local:oauth:authentik");
		expect(migration).toContain("'local:oauth:' || \"provider_id\"");
	});

	it("matches what migration 0005 backfills for password accounts", () => {
		expect(CREDENTIAL_ISSUER).toBe("local:credential");
		expect(migration).toContain(`'${CREDENTIAL_ISSUER}'`);
	});

	it("adds the column nullable before enforcing NOT NULL", () => {
		expect(migration).not.toMatch(/ADD COLUMN "issuer" text NOT NULL/);
		const addAt = migration.indexOf('ADD COLUMN "issuer"');
		const backfillAt = migration.indexOf('UPDATE "accounts" SET "issuer"');
		const enforceAt = migration.indexOf('ALTER COLUMN "issuer" SET NOT NULL');
		expect(addAt).toBeGreaterThanOrEqual(0);
		expect(backfillAt).toBeGreaterThan(addAt);
		expect(enforceAt).toBeGreaterThan(backfillAt);
	});

	it("declares issuer on the accounts schema", async () => {
		const { accounts } = await import("../db/schema");
		expect(Object.keys(accounts)).toContain("issuer");
	});
});
