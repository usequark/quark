#!/usr/bin/env node

/**
 * Regenerate the scaffolded app's initial migration from the source schema.
 *
 * Never capture `prisma migrate diff --script` with a plain `>`: Prisma writes
 * `Loaded Prisma config from prisma.config.js.` to stdout, which lands in the
 * SQL file as an invalid statement. Postgres then rejects the migration with
 * `42601 syntax error at or near "Loaded"` and every scaffolded project fails
 * its first `prisma migrate deploy`.
 *
 * This script renders the diff, strips any leading non-SQL output, and writes
 * the result. `validate-template-migration.js` re-checks the file afterwards.
 *
 * Run with: pnpm --filter @techstream/quark-create-app regen-migration
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TARGET = path.join(
	ROOT,
	"packages/cli/templates/base-project/packages/db/prisma/migrations/20260202061128_initial/migration.sql",
);

/** First token of anything that legitimately starts a SQL statement. */
const SQL_STATEMENT_START =
	/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|COMMENT|BEGIN|COMMIT|ROLLBACK|SET|RESET|WITH|TRUNCATE|REINDEX|ANALYZE|EXPLAIN)\b/i;

function renderSchemaSql() {
	return execSync(
		"pnpm --filter @techstream/quark-db exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
		{ cwd: ROOT, encoding: "utf8" },
	);
}

/**
 * Drop every leading line that is not blank, not a SQL comment, and not the
 * start of a real statement. Throws if a statement is left unterminated.
 */
function stripNonSqlPreamble(sql) {
	const lines = sql.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (!trimmed) continue;

		// A comment or a statement keyword both mean the real SQL starts here.
		// Everything above this point is tool chatter and gets dropped - but
		// leading comments like `-- CreateSchema` must be kept.
		if (
			trimmed.startsWith("--") ||
			trimmed.startsWith("/*") ||
			SQL_STATEMENT_START.test(trimmed)
		) {
			const dropped = lines.slice(0, i);
			while (dropped.length > 0 && !dropped[dropped.length - 1].trim()) {
				dropped.pop();
			}
			return { sql: lines.slice(i).join("\n"), dropped };
		}
	}

	throw new Error(
		"prisma migrate diff produced no SQL statements - refusing to write an empty migration.",
	);
}

function main() {
	const rendered = renderSchemaSql();
	const { sql, dropped } = stripNonSqlPreamble(rendered);
	const stripped = dropped.filter((line) => line.trim());

	if (stripped.length > 0) {
		console.log("🧹 Stripped non-SQL output Prisma wrote to stdout:");
		for (const line of stripped) console.log(`   ${line.trim()}`);
	}

	fs.writeFileSync(TARGET, sql.endsWith("\n") ? sql : `${sql}\n`);
	console.log(
		`✅ Wrote ${path.relative(ROOT, TARGET)} (${sql.split("\n").length} lines)`,
	);
	console.log(
		"   Run `pnpm --filter @techstream/quark-create-app sync-templates` to validate.",
	);
}

main();
