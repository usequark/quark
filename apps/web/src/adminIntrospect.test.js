import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { getParsedSchema, resetSchemaCache } from "@techstream/quark-admin";

const SCHEMA_TEXT = `
enum Role {
	ADMIN
	USER
}

model Widget {
	id   String @id
	name String
	role Role
}
`;

function createFixture({ withSchema = true } = {}) {
	const root = mkdtempSync(join(tmpdir(), "quark-admin-introspect-"));

	if (withSchema) {
		mkdirSync(join(root, "packages/db/prisma"), { recursive: true });
		writeFileSync(join(root, "packages/db/prisma/schema.prisma"), SCHEMA_TEXT);
	}

	return {
		root,
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

function withCwd(nextCwd, run) {
	const previousCwd = process.cwd();
	mkdirSync(nextCwd, { recursive: true });
	process.chdir(nextCwd);
	resetSchemaCache();

	try {
		return run();
	} finally {
		resetSchemaCache();
		process.chdir(previousCwd);
	}
}

describe("admin introspect schema resolution", () => {
	test("reads the schema from the web app cwd", () => {
		const fixture = createFixture();

		try {
			const parsed = withCwd(join(fixture.root, "apps/web"), () =>
				getParsedSchema(),
			);

			assert.deepStrictEqual(
				parsed.models.map((model) => model.name),
				["Widget"],
			);
			assert.deepStrictEqual(
				parsed.enums.map((enumDef) => enumDef.name),
				["Role"],
			);
		} finally {
			fixture.cleanup();
		}
	});

	test("reads the schema from a Next standalone cwd", () => {
		const fixture = createFixture();

		try {
			const parsed = withCwd(
				join(fixture.root, "apps/web/.next/standalone/apps/web"),
				() => getParsedSchema(),
			);

			assert.deepStrictEqual(
				parsed.models.map((model) => model.name),
				["Widget"],
			);
			assert.deepStrictEqual(
				parsed.enums.map((enumDef) => enumDef.name),
				["Role"],
			);
		} finally {
			fixture.cleanup();
		}
	});

	test("reports attempted schema paths when no default schema exists", () => {
		const fixture = createFixture({ withSchema: false });

		try {
			assert.throws(
				() => withCwd(join(fixture.root, "apps/web"), () => getParsedSchema()),
				(error) => {
					assert.match(error.message, /Prisma schema file not found\. Tried:/);
					assert.match(error.message, /packages\/db\/prisma\/schema\.prisma/);
					return true;
				},
			);
		} finally {
			fixture.cleanup();
		}
	});
});
