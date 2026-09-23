import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	coerceId,
	detectIdField,
	getEnums,
	getModelByName,
	getModels,
	parseSchema,
	resetSchemaCache,
} from "./admin.js";

// ---------------------------------------------------------------------------
// Fixture: a minimal Prisma schema
// ---------------------------------------------------------------------------

const SCHEMA = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(VIEWER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  body      String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let schemaDir;

async function setup() {
	schemaDir = await mkdir(join(tmpdir(), "admin-test"), { recursive: true });
	await writeFile(join(schemaDir, "schema.prisma"), SCHEMA);
	resetSchemaCache();
}

async function teardown() {
	await rm(schemaDir, { recursive: true, force: true });
	resetSchemaCache();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("admin - parseSchema returns models and enums", async () => {
	await setup();
	try {
		const result = parseSchema(join(schemaDir, "schema.prisma"));
		assert.ok(result.models.length > 0, "should have models");
		assert.ok(result.enums.length > 0, "should have enums");
	} finally {
		await teardown();
	}
});

test("admin - getModels returns User and Post", async () => {
	await setup();
	try {
		const models = getModels(join(schemaDir, "schema.prisma"));
		const names = models.map((m) => m.name);
		assert.ok(names.includes("User"));
		assert.ok(names.includes("Post"));
	} finally {
		await teardown();
	}
});

test("admin - getEnums returns Role", async () => {
	await setup();
	try {
		const enums = getEnums(join(schemaDir, "schema.prisma"));
		const roleEnum = enums.find((e) => e.name === "Role");
		assert.ok(roleEnum, "should find Role enum");
		assert.deepEqual(roleEnum.values, ["ADMIN", "EDITOR", "VIEWER"]);
	} finally {
		await teardown();
	}
});

test("admin - getModelByName is case-insensitive", async () => {
	await setup();
	try {
		const user = getModelByName("user", join(schemaDir, "schema.prisma"));
		assert.ok(user);
		assert.equal(user.name, "User");
	} finally {
		await teardown();
	}
});

test("admin - getModelByName returns undefined for unknown model", async () => {
	await setup();
	try {
		const result = getModelByName("Comment", join(schemaDir, "schema.prisma"));
		assert.equal(result, undefined);
	} finally {
		await teardown();
	}
});

test("admin - detectIdField returns the @id field", async () => {
	await setup();
	try {
		const user = getModelByName("User", join(schemaDir, "schema.prisma"));
		const idField = detectIdField(user);
		assert.ok(idField);
		assert.equal(idField.name, "id");
		assert.equal(idField.type, "Int");
		assert.equal(idField.isId, true);
	} finally {
		await teardown();
	}
});

test("admin - detectIdField returns null for model without @id", async () => {
	const fakeModel = {
		name: "NoId",
		fields: [{ name: "name", type: "String", isId: false }],
	};
	assert.equal(detectIdField(fakeModel), null);
});

test("admin - coerceId converts string to number for Int @id", async () => {
	await setup();
	try {
		const user = getModelByName("User", join(schemaDir, "schema.prisma"));
		assert.equal(coerceId(user, "42"), 42);
	} finally {
		await teardown();
	}
});

test("admin - coerceId returns string for String @id", async () => {
	const stringIdModel = {
		name: "Thing",
		fields: [{ name: "id", type: "String", isId: true }],
	};
	assert.equal(coerceId(stringIdModel, "abc-123"), "abc-123");
});

test("admin - User model has expected fields", async () => {
	await setup();
	try {
		const user = getModelByName("User", join(schemaDir, "schema.prisma"));
		const fieldNames = user.fields.map((f) => f.name);
		assert.ok(fieldNames.includes("id"));
		assert.ok(fieldNames.includes("email"));
		assert.ok(fieldNames.includes("name"));
		assert.ok(fieldNames.includes("role"));
		assert.ok(fieldNames.includes("createdAt"));
		assert.ok(fieldNames.includes("updatedAt"));
	} finally {
		await teardown();
	}
});

test("admin - User.email is marked @unique", async () => {
	await setup();
	try {
		const user = getModelByName("User", join(schemaDir, "schema.prisma"));
		const email = user.fields.find((f) => f.name === "email");
		assert.ok(email.isUnique);
	} finally {
		await teardown();
	}
});

test("admin - Post.author is an object relation", async () => {
	await setup();
	try {
		const post = getModelByName("Post", join(schemaDir, "schema.prisma"));
		const author = post.fields.find((f) => f.name === "author");
		assert.equal(author.kind, "object");
		assert.equal(author.type, "User");
	} finally {
		await teardown();
	}
});

test("admin - Post.role field resolves enum kind", async () => {
	await setup();
	try {
		const user = getModelByName("User", join(schemaDir, "schema.prisma"));
		const role = user.fields.find((f) => f.name === "role");
		assert.equal(role.kind, "enum");
		assert.equal(role.type, "Role");
		assert.deepEqual(role.enumValues, ["ADMIN", "EDITOR", "VIEWER"]);
	} finally {
		await teardown();
	}
});

test("admin - resetSchemaCache clears the cache", async () => {
	await setup();
	try {
		parseSchema(join(schemaDir, "schema.prisma"));
		resetSchemaCache();
		// After reset, next call re-parses from disk — no error should occur
		const result = parseSchema(join(schemaDir, "schema.prisma"));
		assert.ok(result.models.length > 0);
	} finally {
		await teardown();
	}
});

test("admin - parseSchema returns empty models/enums when no schema found at default paths", () => {
	// Override cwd to a path with no schema.prisma and no env var
	const origCwd = process.cwd;
	const origEnv = process.env.PRISMA_SCHEMA_PATH;
	try {
		process.cwd = () => "/nonexistent";
		delete process.env.PRISMA_SCHEMA_PATH;
		resetSchemaCache();
		const result = parseSchema();
		assert.ok(Array.isArray(result.models));
		assert.ok(Array.isArray(result.enums));
	} finally {
		process.cwd = origCwd;
		if (origEnv !== undefined) process.env.PRISMA_SCHEMA_PATH = origEnv;
	}
});
