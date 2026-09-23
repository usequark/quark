/**
 * @techstream/quark-core - Prisma Schema Introspection
 *
 * Hand-rolled Prisma schema parser that reads `.prisma` files and
 * extracts model and enum definitions.  Used by the admin CRUD layer
 * to auto-generate admin interfaces.
 *
 * The parser is deliberately self-contained — no dependency on Prisma
 * CLI or `@prisma/internals` — so it works in serverless / edge runtimes
 * where those packages are unavailable.
 *
 * Usage:
 *   import { parseSchema, getModelByName, detectIdField, coerceId } from "@techstream/quark-core/admin";
 */

import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SCHEMA_RELATIVE_PATHS = [
	"schema.prisma",
	"packages/db/prisma/schema.prisma",
	"../../packages/db/prisma/schema.prisma",
	// In Next.js standalone, cwd = .next/standalone/<app>
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

const NUMERIC_TYPES = new Set(["Int", "Float", "Decimal", "BigInt"]);

const CACHE_TTL_MS = 5_000;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** @type {{ models: Model[], enums: EnumDef[] } | null} */
let _parsed = null;
let _parsedAt = 0;

/**
 * Reset the schema cache. Useful for testing.
 */
export function resetSchemaCache() {
	_parsed = null;
	_parsedAt = 0;
}

// ---------------------------------------------------------------------------
// Schema file resolution
// ---------------------------------------------------------------------------

/**
 * Reads the Prisma schema text from disk, resolving the file path from
 * environment variables, explicit override, or default relative paths.
 *
 * @param {string} [schemaPath] - Explicit path override
 * @returns {string | null} Schema text, or null if not found
 */
function readSchemaText(schemaPath) {
	if (schemaPath) {
		const resolved = path.resolve(schemaPath);
		if (existsSync(resolved)) return readFileSync(resolved, "utf-8");
		throw new Error(
			`Prisma schema file not found at override path: ${schemaPath}`,
		);
	}

	const envPath = process.env.PRISMA_SCHEMA_PATH;
	if (envPath) {
		const resolved = path.resolve(envPath);
		if (existsSync(resolved)) return readFileSync(resolved, "utf-8");
	}

	const candidates = [
		...new Set(
			DEFAULT_SCHEMA_RELATIVE_PATHS.map((rp) =>
				path.resolve(process.cwd(), rp),
			),
		),
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return readFileSync(candidate, "utf-8");
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse the Prisma schema and return models + enums.
 * Result is cached with a 5-second TTL so schema changes are picked up
 * without requiring a full process restart.
 *
 * @param {string} [schemaPath] - Explicit path override
 * @returns {{ models: Model[], enums: EnumDef[] }}
 */
export function parseSchema(schemaPath) {
	const now = Date.now();
	if (_parsed && now - _parsedAt < CACHE_TTL_MS) return _parsed;

	const text = readSchemaText(schemaPath);
	if (text === null) {
		_parsed = { models: [], enums: [] };
		_parsedAt = now;
		return _parsed;
	}

	_parsed = parseSchemaText(text);
	_parsedAt = now;
	return _parsed;
}

/**
 * Returns all model definitions from the Prisma schema.
 * @param {string} [schemaPath]
 * @returns {Model[]}
 */
export function getModels(schemaPath) {
	return parseSchema(schemaPath).models;
}

/**
 * Returns all enum definitions from the Prisma schema.
 * @param {string} [schemaPath]
 * @returns {EnumDef[]}
 */
export function getEnums(schemaPath) {
	return parseSchema(schemaPath).enums;
}

/**
 * Returns a single model definition by name (case-insensitive).
 * @param {string} name
 * @param {string} [schemaPath]
 * @returns {Model | undefined}
 */
export function getModelByName(name, schemaPath) {
	const lower = name.toLowerCase();
	return parseSchema(schemaPath).models.find(
		(m) => m.name.toLowerCase() === lower,
	);
}

/**
 * Returns the @id field for a model, or null if none exists.
 * @param {Model} model
 * @returns {Field | null}
 */
export function detectIdField(model) {
	return model.fields.find((f) => f.isId) ?? null;
}

/**
 * Coerce a raw string ID to the correct type for a model's @id field.
 * @param {Model} model
 * @param {string} rawId
 * @returns {string | number}
 */
export function coerceId(model, rawId) {
	const field = detectIdField(model);
	if (field && NUMERIC_TYPES.has(field.type)) return Number(rawId);
	return rawId;
}

// ---------------------------------------------------------------------------
// Internal parser
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @returns {{ models: Model[], enums: EnumDef[] }}
 */
function parseSchemaText(text) {
	const lines = text.split("\n");

	// --- Enums (first pass) ---
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

	// --- Models (second pass) ---
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

/**
 * @param {string} line
 * @returns {string}
 */
function stripComment(line) {
	const idx = line.indexOf("//");
	return idx >= 0 ? line.substring(0, idx) : line;
}

/**
 * @param {string} line
 * @param {Set<string>} enumNames
 * @param {Record<string, string[]>} enumByName
 * @returns {Field | null}
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

	const isRequired = !isOptional && !isList;

	const restStr = tokens.slice(2).join(" ");

	let kind;
	if (SCALAR_TYPES.has(typeStr)) {
		kind = "scalar";
	} else if (enumNames.has(typeStr)) {
		kind = "enum";
	} else {
		kind = "object";
	}

	const isId = /(?:^|\s)@id(?:\s|$)/.test(restStr);
	const isUnique = /(?:^|\s)@unique(?:\s|$)/.test(restStr);
	const hasDefaultValue = /(?:^|\s)@default\(/.test(restStr);
	const isReadOnly = /(?:^|\s)@updatedAt(?:\s|$)/.test(restStr);

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Field
 * @property {string} name
 * @property {string} type
 * @property {"scalar" | "enum" | "object"} kind
 * @property {boolean} isList
 * @property {boolean} isRequired
 * @property {boolean} isId
 * @property {boolean} isReadOnly
 * @property {boolean} hasDefaultValue
 * @property {boolean} isUnique
 * @property {string | null} relationName
 * @property {string[] | null} enumValues
 * @property {string | null} documentation
 */

/**
 * @typedef {Object} Model
 * @property {string} name
 * @property {Field[]} fields
 * @property {string | null} dbName
 */

/**
 * @typedef {Object} EnumDef
 * @property {string} name
 * @property {string[]} values
 */
