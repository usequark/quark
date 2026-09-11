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

function normalizeSqlStatements(sql) {
	const withoutComments = sql
		.split(/\r?\n/)
		.filter((line) => !line.trim().startsWith("--"))
		.filter((line) => !line.trim().startsWith("Loaded Prisma config"))
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
	const expectedStatements = normalizeSqlStatements(renderSchemaSql());
	const actualStatements = normalizeSqlStatements(
		fs.readFileSync(TEMPLATE_MIGRATION_PATH, "utf8"),
	);

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
		"     pnpm --filter @techstream/quark-db exec prisma migrate diff \\",
	);
	console.error(
		"       --from-empty --to-schema prisma/schema.prisma --script \\",
	);
	console.error(
		"       > packages/cli/templates/base-project/packages/db/prisma/migrations/20260202061128_initial/migration.sql",
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
