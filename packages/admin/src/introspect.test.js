import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
	getEnums,
	getModel,
	getModelBySlug,
	getModels,
	hasIdField,
	modelToSlug,
	resetSchemaCache,
} from "./introspect.js";

// Minimal schema fixture covering all cases we care about
const FIXTURE_SCHEMA = `
enum JobStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String?
  role      String   @default("viewer")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts     Post[]
}

model Post {
  id        String     @id @default(cuid())
  title     String
  body      String?
  status    JobStatus  @default(PENDING)
  authorId  String
  author    User       @relation(fields: [authorId], references: [id])
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([authorId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  createdAt  DateTime @default(now())

  @@unique([identifier, token])
}
`;

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fixtureSchemaPath;

before(() => {
	// Write the fixture schema to a temp file so introspect.js can read it
	fixtureSchemaPath = join(tmpdir(), "test-schema.prisma");
	writeFileSync(fixtureSchemaPath, FIXTURE_SCHEMA, "utf-8");
});

after(() => {
	resetSchemaCache();
});

describe("introspect - getModels", () => {
	before(() => resetSchemaCache());

	it("returns all models from schema", () => {
		const models = getModels(fixtureSchemaPath);
		assert.equal(models.length, 3);
		const names = models.map((m) => m.name);
		assert.ok(names.includes("User"));
		assert.ok(names.includes("Post"));
		assert.ok(names.includes("VerificationToken"));
	});

	it("User model has correct fields", () => {
		const [user] = getModels(fixtureSchemaPath);
		const fieldNames = user.fields.map((f) => f.name);
		assert.ok(fieldNames.includes("id"));
		assert.ok(fieldNames.includes("email"));
		assert.ok(fieldNames.includes("password"));
		assert.ok(fieldNames.includes("createdAt"));
		assert.ok(fieldNames.includes("updatedAt"));
		assert.ok(fieldNames.includes("posts"));
	});

	it("User.id has correct metadata", () => {
		resetSchemaCache();
		const [user] = getModels(fixtureSchemaPath);
		const id = user.fields.find((f) => f.name === "id");
		assert.equal(id.kind, "scalar");
		assert.equal(id.type, "String");
		assert.equal(id.isId, true);
		assert.equal(id.isRequired, true);
		assert.equal(id.isList, false);
		assert.equal(id.hasDefaultValue, true);
	});

	it("User.email is required and unique", () => {
		resetSchemaCache();
		const [user] = getModels(fixtureSchemaPath);
		const email = user.fields.find((f) => f.name === "email");
		assert.equal(email.isRequired, true);
		assert.equal(email.isUnique, true);
		assert.equal(email.kind, "scalar");
	});

	it("User.name is optional (nullable)", () => {
		resetSchemaCache();
		const [user] = getModels(fixtureSchemaPath);
		const name = user.fields.find((f) => f.name === "name");
		assert.equal(name.isRequired, false);
	});

	it("User.updatedAt has isReadOnly=true from @updatedAt", () => {
		resetSchemaCache();
		const [user] = getModels(fixtureSchemaPath);
		const updatedAt = user.fields.find((f) => f.name === "updatedAt");
		assert.equal(updatedAt.isReadOnly, true);
	});

	it("User.createdAt has hasDefaultValue=true", () => {
		resetSchemaCache();
		const [user] = getModels(fixtureSchemaPath);
		const createdAt = user.fields.find((f) => f.name === "createdAt");
		assert.equal(createdAt.hasDefaultValue, true);
	});

	it("User.posts is a list relation (object kind)", () => {
		resetSchemaCache();
		const [user] = getModels(fixtureSchemaPath);
		const posts = user.fields.find((f) => f.name === "posts");
		assert.equal(posts.kind, "object");
		assert.equal(posts.isList, true);
	});

	it("Post.status is an enum field with values", () => {
		resetSchemaCache();
		const models = getModels(fixtureSchemaPath);
		const post = models.find((m) => m.name === "Post");
		const status = post.fields.find((f) => f.name === "status");
		assert.equal(status.kind, "enum");
		assert.deepEqual(status.enumValues, [
			"PENDING",
			"IN_PROGRESS",
			"COMPLETED",
		]);
	});
});

describe("introspect - getEnums", () => {
	before(() => resetSchemaCache());

	it("returns all enums", () => {
		const enums = getEnums(fixtureSchemaPath);
		assert.equal(enums.length, 1);
		assert.equal(enums[0].name, "JobStatus");
		assert.deepEqual(enums[0].values, ["PENDING", "IN_PROGRESS", "COMPLETED"]);
	});
});

describe("introspect - getModel / getModelBySlug", () => {
	before(() => resetSchemaCache());

	it("getModel finds by exact name", () => {
		const m = getModel("User", fixtureSchemaPath);
		assert.equal(m.name, "User");
	});

	it("getModel is case-insensitive", () => {
		resetSchemaCache();
		const m = getModel("user", fixtureSchemaPath);
		assert.equal(m.name, "User");
	});

	it("getModelBySlug finds AuditLog-style multi-word by slug", () => {
		resetSchemaCache();
		const _models = getModels(fixtureSchemaPath);
		const post = getModelBySlug("post", fixtureSchemaPath);
		assert.equal(post.name, "Post");
	});

	it("getModelBySlug returns undefined for unknown slug", () => {
		resetSchemaCache();
		const result = getModelBySlug("nonexistent", fixtureSchemaPath);
		assert.equal(result, undefined);
	});
});

describe("introspect - modelToSlug", () => {
	it("lowercases model names", () => {
		assert.equal(modelToSlug("User"), "user");
		assert.equal(modelToSlug("AuditLog"), "auditlog");
		assert.equal(modelToSlug("VerificationToken"), "verificationtoken");
	});
});

describe("introspect - hasIdField", () => {
	before(() => resetSchemaCache());

	it("User has an id field", () => {
		const user = getModel("User", fixtureSchemaPath);
		assert.equal(hasIdField(user), true);
	});

	it("VerificationToken has no single @id field", () => {
		resetSchemaCache();
		const vt = getModel("VerificationToken", fixtureSchemaPath);
		assert.equal(hasIdField(vt), false);
	});
});

describe("introspect - cache", () => {
	it("returns cached result on second call", () => {
		resetSchemaCache();
		const a = getModels(fixtureSchemaPath);
		const b = getModels(fixtureSchemaPath);
		assert.equal(a, b); // same reference
	});

	it("resetSchemaCache forces re-read", () => {
		resetSchemaCache();
		const a = getModels(fixtureSchemaPath);
		resetSchemaCache();
		const b = getModels(fixtureSchemaPath);
		// Different reference after reset
		assert.notEqual(a, b);
	});
});
