#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TEMPLATE_MIGRATION_PATH = path.join(
	ROOT,
	"packages/cli/templates/base-project/packages/db/prisma/migrations/20260202061128_initial/migration.sql",
);

/**
 * Prisma writes `Loaded Prisma config from prisma.config.js.` to stdout, so it
 * contaminates `migrate diff --script` output. It is stripped from the RENDERED
 * diff only, for comparison purposes - a template file that actually contains
 * this line is a hard failure (see findPreambleLines), because Postgres rejects
 * it with `42601 syntax error at or near "Loaded"` and every scaffolded project
 * then fails `prisma migrate deploy`.
 */
const PRISMA_LOG_NOISE = /^Loaded Prisma config\b/;

/** First token of anything that legitimately starts a SQL statement. */
const SQL_STATEMENT_START =
	/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|COMMENT|BEGIN|COMMIT|ROLLBACK|SET|RESET|WITH|TRUNCATE|REINDEX|ANALYZE|EXPLAIN)\b/i;

function stripPrismaLogNoise(sql) {
	return sql
		.split(/\r?\n/)
		.filter((line) => !PRISMA_LOG_NOISE.test(line.trim()))
		.join("\n");
}

/**
 * Return the leading lines of `sql` that are neither blank, nor SQL comments,
 * nor the start of a real statement. A clean migration returns `[]`.
 */
function findPreambleLines(sql) {
	const offenders = [];

	for (const line of sql.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("--") || trimmed.startsWith("/*")) continue;
		if (SQL_STATEMENT_START.test(trimmed)) return offenders;
		offenders.push(line);
	}

	return offenders;
}

function normalizeSqlStatements(sql) {
	const withoutComments = sql
		.split(/\r?\n/)
		.filter((line) => !line.trim().startsWith("--"))
		.join("\n");

	return withoutComments
		.split(";")
		.map((statement) => statement.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.filter((statement) => statement !== 'CREATE SCHEMA IF NOT EXISTS "public"')
		.sort();
}

function renderSchemaSql() {
	return execSync(
		"pnpm --filter @techstream/quark-db exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
		{
			cwd: ROOT,
			encoding: "utf8",
		},
	);
}

function formatStatementPreview(statement) {
	return statement.length > 140 ? `${statement.slice(0, 137)}...` : statement;
}

function main() {
	const templateSql = fs.readFileSync(TEMPLATE_MIGRATION_PATH, "utf8");
	const preamble = findPreambleLines(templateSql);

	if (preamble.length > 0) {
		console.error("❌ Template migration starts with a non-SQL preamble.");
		console.error("");
		console.error(
			"   Postgres executes this file verbatim, so anything that is",
		);
		console.error("   not SQL makes `prisma migrate deploy` fail with:");
		console.error('     42601 syntax error at or near "..."');
		console.error("   and every newly scaffolded project ships that failure.");
		console.error("");
		console.error("   Offending line(s):");
		for (const line of preamble.slice(0, 5)) {
			console.error(`     ${line}`);
		}
		console.error("");
		console.error(
			"   Prisma prints `Loaded Prisma config from prisma.config.js.` to",
		);
		console.error(
			"   stdout, so it lands in the file when the diff is captured",
		);
		console.error("   with a plain `>`. Regenerate safely instead:");
		console.error(
			"     pnpm --filter @techstream/quark-create-app regen-migration",
		);
		process.exit(1);
	}

	const expectedStatements = normalizeSqlStatements(
		stripPrismaLogNoise(renderSchemaSql()),
	);
	const actualStatements = normalizeSqlStatements(templateSql);

	if (JSON.stringify(expectedStatements) === JSON.stringify(actualStatements)) {
		console.log("✅ Template migration matches the current schema.");
		return;
	}

	const expectedSet = new Set(expectedStatements);
	const actualSet = new Set(actualStatements);
	const missingStatements = expectedStatements.filter(
		(statement) => !actualSet.has(statement),
	);
	const extraStatements = actualStatements.filter(
		(statement) => !expectedSet.has(statement),
	);

	console.error("❌ Template migration drift detected.");
	console.error("");
	console.error("   The template migration SQL must match the source schema.");
	console.error(
		"   Do NOT edit template files directly — they are synced from monorepo source.",
	);
	console.error("");
	console.error("   To fix, regenerate the migration SQL:");
	console.error(
		"     pnpm --filter @techstream/quark-create-app regen-migration",
	);
	console.error("");
	console.error(
		"   Do NOT capture `prisma migrate diff` with a plain `>` - Prisma",
	);
	console.error(
		"   writes its `Loaded Prisma config ...` log line to stdout and it",
	);
	console.error(
		"   would be written into the SQL file as an invalid statement.",
	);
	console.error("");
	console.error("   Or run sync-templates to validate:");
	console.error(
		"     pnpm --filter @techstream/quark-create-app sync-templates",
	);

	if (missingStatements.length > 0) {
		console.error("\nMissing statements:");
		for (const statement of missingStatements.slice(0, 10)) {
			console.error(`  + ${formatStatementPreview(statement)}`);
		}
	}

	if (extraStatements.length > 0) {
		console.error("\nExtra statements:");
		for (const statement of extraStatements.slice(0, 10)) {
			console.error(`  - ${formatStatementPreview(statement)}`);
		}
	}

	process.exit(1);
}

main();
