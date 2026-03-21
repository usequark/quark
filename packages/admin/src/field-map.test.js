import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getInputType,
	isEditable,
	isListVisible,
	isSystemField,
} from "./field-map.js";

/** @param {Partial<import('./types.js').Field>} overrides */
function field(overrides) {
	return {
		name: "testField",
		type: "String",
		kind: "scalar",
		isList: false,
		isRequired: true,
		isId: false,
		isReadOnly: false,
		hasDefaultValue: false,
		isUnique: false,
		relationName: null,
		enumValues: null,
		documentation: null,
		...overrides,
	};
}

describe("getInputType", () => {
	it("returns hidden for @id fields", () => {
		assert.equal(getInputType(field({ isId: true })), "hidden");
	});

	it("returns hidden for createdAt system field", () => {
		assert.equal(
			getInputType(
				field({ name: "createdAt", type: "DateTime", hasDefaultValue: true }),
			),
			"hidden",
		);
	});

	it("returns hidden for updatedAt @updatedAt field", () => {
		assert.equal(
			getInputType(
				field({ name: "updatedAt", type: "DateTime", isReadOnly: true }),
			),
			"hidden",
		);
	});

	it("returns hidden for password field", () => {
		assert.equal(getInputType(field({ name: "password" })), "hidden");
	});

	it("returns hidden for hashedPassword field", () => {
		assert.equal(getInputType(field({ name: "hashedPassword" })), "hidden");
	});

	it("returns select for enum fields", () => {
		assert.equal(
			getInputType(
				field({ kind: "enum", type: "JobStatus", enumValues: ["A", "B"] }),
			),
			"select",
		);
	});

	it("returns relation for object fields", () => {
		assert.equal(
			getInputType(
				field({ kind: "object", type: "User", relationName: "UserToPost" }),
			),
			"relation",
		);
	});

	it("returns email for email field", () => {
		assert.equal(
			getInputType(field({ name: "email", type: "String" })),
			"email",
		);
	});

	it("returns textarea for description field", () => {
		assert.equal(
			getInputType(field({ name: "description", type: "String" })),
			"textarea",
		);
	});

	it("returns textarea for body field", () => {
		assert.equal(
			getInputType(field({ name: "body", type: "String" })),
			"textarea",
		);
	});

	it("returns json for Json type", () => {
		assert.equal(
			getInputType(field({ name: "metadata", type: "Json" })),
			"json",
		);
	});

	it("returns number for Int", () => {
		assert.equal(getInputType(field({ name: "count", type: "Int" })), "number");
	});

	it("returns number for Float", () => {
		assert.equal(
			getInputType(field({ name: "amount", type: "Float" })),
			"number",
		);
	});

	it("returns checkbox for Boolean", () => {
		assert.equal(
			getInputType(field({ name: "active", type: "Boolean" })),
			"checkbox",
		);
	});

	it("returns datetime-local for DateTime", () => {
		assert.equal(
			getInputType(field({ name: "publishedAt", type: "DateTime" })),
			"datetime-local",
		);
	});

	it("falls back to text for unknown scalar types", () => {
		assert.equal(
			getInputType(field({ name: "custom", type: "UnknownType" })),
			"text",
		);
	});
});

describe("isListVisible", () => {
	it("hides object (relation) fields", () => {
		assert.equal(isListVisible(field({ kind: "object", type: "User" })), false);
	});

	it("hides Json fields (too large for table)", () => {
		assert.equal(isListVisible(field({ type: "Json" })), false);
	});

	it("hides sensitive fields", () => {
		assert.equal(isListVisible(field({ name: "password" })), false);
	});

	it("shows scalar non-sensitive fields", () => {
		assert.equal(isListVisible(field({ name: "email", type: "String" })), true);
	});

	it("shows enum fields", () => {
		assert.equal(
			isListVisible(field({ kind: "enum", type: "JobStatus" })),
			true,
		);
	});
});

describe("isEditable", () => {
	it("excludes id fields", () => {
		assert.equal(isEditable(field({ isId: true })), false);
	});

	it("excludes @updatedAt fields", () => {
		assert.equal(
			isEditable(field({ name: "updatedAt", isReadOnly: true })),
			false,
		);
	});

	it("excludes object (relation) fields", () => {
		assert.equal(isEditable(field({ kind: "object", type: "User" })), false);
	});

	it("excludes sensitive fields", () => {
		assert.equal(isEditable(field({ name: "password" })), false);
	});

	it("excludes createdAt system field", () => {
		assert.equal(
			isEditable(
				field({ name: "createdAt", type: "DateTime", hasDefaultValue: true }),
			),
			false,
		);
	});

	it("excludes updatedAt with @default (no @updatedAt but still system)", () => {
		assert.equal(
			isEditable(
				field({ name: "updatedAt", type: "DateTime", hasDefaultValue: true }),
			),
			false,
		);
	});

	it("includes regular String fields", () => {
		assert.equal(isEditable(field({ name: "title", type: "String" })), true);
	});

	it("includes enum fields", () => {
		assert.equal(
			isEditable(field({ kind: "enum", type: "JobStatus", enumValues: ["A"] })),
			true,
		);
	});

	it("includes optional String fields", () => {
		assert.equal(
			isEditable(field({ name: "bio", type: "String", isRequired: false })),
			true,
		);
	});
});

describe("isSystemField", () => {
	it("true for createdAt with @default", () => {
		assert.equal(
			isSystemField(
				field({ name: "createdAt", type: "DateTime", hasDefaultValue: true }),
			),
			true,
		);
	});

	it("true for updatedAt with @updatedAt (isReadOnly)", () => {
		assert.equal(
			isSystemField(
				field({ name: "updatedAt", type: "DateTime", isReadOnly: true }),
			),
			true,
		);
	});

	it("false for non-system field with default", () => {
		// role String @default("viewer") — has default but NOT a system field name
		assert.equal(
			isSystemField(
				field({ name: "role", type: "String", hasDefaultValue: true }),
			),
			false,
		);
	});
});
