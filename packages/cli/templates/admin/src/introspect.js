import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { AppError } from "@techstream/quark-core/errors";

const DEFAULT_SCHEMA_RELATIVE_PATHS = [
	// Copied into standalone root by prepare-standalone.mjs
	"schema.prisma",
	"packages/db/prisma/schema.prisma",
	"../../packages/db/prisma/schema.prisma",
	// In Next standalone, cwd becomes /app/apps/web/.next/standalone/apps/web.
	"../../../../../../packages/db/prisma/schema.prisma",
];

const SCALAR_TYPES = new Set([
	"String",
	"Int",
	"Float",
	"Decimal",
	"BigInt",
	"Boolean",
	"DateTime",
	"Json",
	"Bytes",
]);

const CACHE_TTL_MS = 5_000;

/** @type {{ models: import('./types.js').Model[], enums: import('./types.js').EnumDef[] } | null} */
let _parsed = null;

/** @type {number} */
let _parsedAt = 0;

/**
 * Parse the Prisma schema and return models + enums.
 * Result is cached with a 5-second TTL so schema changes are picked up
 * without requiring a full process restart.
 * @param {string} [schemaPath]
 */
export function getParsedSchema(schemaPath) {
	const now = Date.now();
	if (_parsed && now - _parsedAt < CACHE_TTL_MS) return _parsed;
	const text = readSchemaText(schemaPath);
	if (text === null) {
		_parsed = { models: [], enums: [] };
		_parsedAt = now;
		return _parsed;
	}
	_parsed = parseSchema(text);
	_parsedAt = now;
	return _parsed;
}

function readSchemaText(schemaPath) {
	if (schemaPath) {
		return readFileSync(resolveSchemaPath(schemaPath), "utf-8");
	}

	const defaultSchemaPaths = getDefaultSchemaPaths();

	for (const candidatePath of defaultSchemaPaths) {
		if (existsSync(candidatePath)) {
			return readFileSync(candidatePath, "utf-8");
		}
	}

	console.error(
		`[admin] failed to read Prisma schema — tried: ${defaultSchemaPaths.join(", ")}`,
	);
	return null;
}

function getDefaultSchemaPaths() {
	return [
		...new Set(
			DEFAULT_SCHEMA_RELATIVE_PATHS.map((relativePath) =>
				path.resolve(process.cwd(), relativePath),
			),
		),
	];
}

function resolveSchemaPath(schemaPath) {
	if (existsSync(schemaPath)) {
		return schemaPath;
	}

	throw new AppError(
		`Prisma schema file not found at override path: ${schemaPath}`,
		500,
		"PRISMA_SCHEMA_NOT_FOUND",
	);
}

/**
 * Reset the schema cache. Useful for testing.
 */
export function resetSchemaCache() {
	_parsed = null;
	_parsedAt = 0;
}

/**
 * Returns all model definitions from the Prisma schema.
 * @param {string} [schemaPath]
 * @returns {import('./types.js').Model[]}
 */
export function getModels(schemaPath) {
	return getParsedSchema(schemaPath).models;
}

/**
 * Returns all enum definitions from the Prisma schema.
 * @param {string} [schemaPath]
 * @returns {import('./types.js').EnumDef[]}
 */
export function getEnums(schemaPath) {
	return getParsedSchema(schemaPath).enums;
}

/**
 * Returns a single model definition by name (case-insensitive).
 * @param {string} name - Model name (e.g. "User" or "user")
 * @param {string} [schemaPath]
 * @returns {import('./types.js').Model | undefined}
 */
export function getModel(name, schemaPath) {
	const lower = name.toLowerCase();
	return getParsedSchema(schemaPath).models.find(
		(m) => m.name.toLowerCase() === lower,
	);
}

/**
 * Returns a model by its URL slug (lowercased model name).
 * Example: "user" → User, "auditlog" → AuditLog
 * @param {string} slug
 * @param {string} [schemaPath]
 * @returns {import('./types.js').Model | undefined}
 */
export function getModelBySlug(slug, schemaPath) {
	return getModel(slug, schemaPath);
}

/**
 * Converts a model name to a URL slug.
 * @param {string} name
 * @returns {string}
 */
export function modelToSlug(name) {
	return name.toLowerCase();
}

/**
 * Returns true if the model has a single @id field (required for CRUD operations).
 * Models without a single @id (e.g. VerificationToken with @@unique) cannot use generic CRUD.
 * @param {import('./types.js').Model} model
 * @returns {boolean}
 */
export function hasIdField(model) {
	return model.fields.some((f) => f.isId);
}

/**
 * Returns the @id field for a model, or null if none exists.
 * @param {import('./types.js').Model} model
 * @returns {import('./types.js').Field | null}
 */
export function getIdField(model) {
	return model.fields.find((f) => f.isId) ?? null;
}

const NUMERIC_TYPES = new Set(["Int", "Float", "Decimal", "BigInt"]);

/**
 * Coerce a raw string ID (e.g. from a URL param) to the correct type for a model's @id field.
 * Necessary because URL params are always strings but Prisma rejects a string for Int PKs.
 * @param {import('./types.js').Model} model
 * @param {string} rawId
 * @returns {string | number}
 */
export function coerceId(model, rawId) {
	const field = getIdField(model);
	if (field && NUMERIC_TYPES.has(field.type)) return Number(rawId);
	return rawId;
}

// ─── Schema Parser ────────────────────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {{ models: import('./types.js').Model[], enums: import('./types.js').EnumDef[] }}
 */
function parseSchema(text) {
	const lines = text.split("\n");

	// Pass 1: collect all enum definitions (models may appear before enums in schema)
	const enums = [];
	let inEnum = null;

	for (const line of lines) {
		const stripped = stripComment(line).trim();

		if (inEnum) {
			if (stripped === "}") {
				inEnum = null;
			} else if (stripped) {
				const val = stripped.split(/\s+/)[0];
				if (val && !val.startsWith("@") && !val.startsWith("//")) {
					enums[enums.length - 1].values.push(val);
				}
			}
		} else {
			const m = stripped.match(/^enum\s+(\w+)\s*\{/);
			if (m) {
				inEnum = m[1];
				enums.push({ name: m[1], values: [] });
			}
		}
	}

	const enumNames = new Set(enums.map((e) => e.name));
	const enumByName = Object.fromEntries(enums.map((e) => [e.name, e.values]));

	// Pass 2: collect model definitions
	const models = [];
	let inModel = null;

	for (const line of lines) {
		const stripped = stripComment(line).trim();

		if (inModel) {
			if (stripped === "}") {
				inModel = null;
			} else if (stripped && !stripped.startsWith("@@")) {
				const field = parseField(stripped, enumNames, enumByName);
				if (field) models[models.length - 1].fields.push(field);
			}
		} else {
			const m = stripped.match(/^model\s+(\w+)\s*\{/);
			if (m) {
				inModel = m[1];
				models.push({ name: m[1], fields: [], dbName: null });
			}
		}
	}

	return { models, enums };
}

/** @param {string} line */
function stripComment(line) {
	const idx = line.indexOf("//");
	return idx >= 0 ? line.substring(0, idx) : line;
}

/**
 * Parse a single field line from a Prisma model block.
 * @param {string} line
 * @param {Set<string>} enumNames
 * @param {Record<string, string[]>} enumByName
 * @returns {import('./types.js').Field | null}
 */
function parseField(line, enumNames, enumByName) {
	const tokens = line.split(/\s+/);
	if (tokens.length < 2) return null;

	const name = tokens[0];
	if (name.startsWith("@") || name.startsWith("//")) return null;

	let typeStr = tokens[1];

	const isList = typeStr.endsWith("[]");
	if (isList) typeStr = typeStr.slice(0, -2);

	const isOptional = typeStr.endsWith("?");
	if (isOptional) typeStr = typeStr.slice(0, -1);

	// Required = not optional, not a list relation (list relations are never "required" in the input sense)
	const isRequired = !isOptional && !isList;

	const restStr = tokens.slice(2).join(" ");

	let kind;
	if (SCALAR_TYPES.has(typeStr)) {
		kind = "scalar";
	} else if (enumNames.has(typeStr)) {
		kind = "enum";
	} else {
		kind = "object"; // relation to another model
	}

	const isId = /(?:^|\s)@id(?:\s|$)/.test(restStr);
	const isUnique = /(?:^|\s)@unique(?:\s|$)/.test(restStr);
	const hasDefaultValue = /(?:^|\s)@default\(/.test(restStr);
	// @updatedAt means Prisma manages this field - treat as read-only
	const isReadOnly = /(?:^|\s)@updatedAt(?:\s|$)/.test(restStr);

	// Relation name - only meaningful for object kinds
	let relationName = null;
	if (kind === "object") {
		const namedMatch = restStr.match(/@relation\(\s*name:\s*"([^"]+)"/);
		relationName = namedMatch ? namedMatch[1] : `${typeStr}To${name}`;
	}

	return {
		name,
		type: typeStr,
		kind,
		isList,
		isRequired,
		isId,
		isReadOnly,
		hasDefaultValue,
		isUnique,
		relationName,
		enumValues: kind === "enum" ? (enumByName[typeStr] ?? null) : null,
		documentation: null,
	};
}
