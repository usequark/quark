import { adminConfig } from "./config.js";

const SENSITIVE_FIELD_NAMES = new Set([
	"password",
	"hashedPassword",
	"passwordHash",
	"secret",
	"secretKey",
	"privateKey",
]);

/**
 * Get the effective set of sensitive field names for a model.
 * If the model has an explicit `hiddenFields` override, that replaces
 * the global SENSITIVE_FIELD_NAMES entirely. This allows models like
 * User to expose fields (e.g. password) by setting `hiddenFields: []`.
 * @param {string} [modelName]
 * @returns {Set<string>}
 */
function getSensitiveFieldNames(modelName) {
	if (!modelName) return SENSITIVE_FIELD_NAMES;
	const overrides = adminConfig.modelOverrides?.[modelName];
	if (overrides && "hiddenFields" in overrides) {
		return new Set(overrides.hiddenFields ?? []);
	}
	return SENSITIVE_FIELD_NAMES;
}

const IMAGE_FIELD_SUFFIXES = [
	"image",
	"photo",
	"avatar",
	"thumbnail",
	"banner",
	"logo",
];

const LONG_TEXT_FIELD_NAMES = new Set([
	"description",
	"content",
	"body",
	"notes",
	"bio",
	"summary",
	"message",
	"text",
	"comment",
]);

const SYSTEM_FIELD_NAMES = new Set(["createdAt", "updatedAt"]);

const SCALAR_TYPE_TO_INPUT = {
	String: "text",
	Int: "number",
	Float: "number",
	Decimal: "number",
	BigInt: "number",
	Boolean: "checkbox",
	DateTime: "datetime-local",
	Json: "json",
	Bytes: "text",
};

/**
 * Returns the HTML input type for a Prisma field.
 * @param {import('./types.js').Field} field
 * @param {string} [modelName]
 * @returns {"text"|"email"|"number"|"checkbox"|"datetime-local"|"select"|"textarea"|"richtext"|"json"|"relation"|"hidden"|"password"}
 */
export function getInputType(field, modelName) {
	const sensitiveNames = getSensitiveFieldNames(modelName);

	// IDs and system fields are never shown in forms
	if (field.isId) return "hidden";
	if (isSystemField(field)) return "hidden";
	if (sensitiveNames.has(field.name)) return "hidden";

	// Password fields → masked password input
	if (field.name === "password" && field.type === "String") return "password";

	// Enum fields → select dropdown
	if (field.kind === "enum") return "select";

	// Relations → rendered separately (not a simple input)
	if (field.kind === "object") return "relation";

	// Email heuristic
	if (field.name === "email" && field.type === "String") return "email";

	// Image URL heuristic - fields whose names end with an image-related word
	if (field.type === "String") {
		const lower = field.name.toLowerCase();
		if (IMAGE_FIELD_SUFFIXES.some((s) => lower === s || lower.endsWith(s)))
			return "image";
	}

	// Long text fields → rich text editor
	if (field.type === "String" && LONG_TEXT_FIELD_NAMES.has(field.name))
		return "richtext";

	// JSON → special textarea with formatting
	if (field.type === "Json") return "json";

	return SCALAR_TYPE_TO_INPUT[field.type] ?? "text";
}

/**
 * Returns true if the field should be visible as a column in list (table) views.
 * @param {import('./types.js').Field} field
 * @param {string} [modelName]
 */
export function isListVisible(field, modelName) {
	const sensitiveNames = getSensitiveFieldNames(modelName);
	// Relations don't make sense as table columns
	if (field.kind === "object") return false;
	// JSON blobs are too large for table cells
	if (field.type === "Json") return false;
	if (sensitiveNames.has(field.name)) return false;
	return true;
}

/**
 * Returns true if the field should be editable in forms.
 * Excludes: IDs, system timestamps, Prisma-managed fields (@updatedAt), relations, sensitive fields.
 * @param {import('./types.js').Field} field
 * @param {string} [modelName]
 */
export function isEditable(field, modelName) {
	const sensitiveNames = getSensitiveFieldNames(modelName);
	if (field.isId) return false;
	if (field.isReadOnly) return false; // @updatedAt
	if (isSystemField(field)) return false; // createdAt @default(now()), updatedAt @default(now())
	if (field.kind === "object") return false; // relations
	if (sensitiveNames.has(field.name)) return false;
	return true;
}

/**
 * Returns true if the field is a system-managed timestamp.
 * @param {import('./types.js').Field} field
 */
export function isSystemField(field) {
	return (
		SYSTEM_FIELD_NAMES.has(field.name) &&
		(field.hasDefaultValue || field.isReadOnly)
	);
}

/**
 * Returns true if the field is suitable for text search (Prisma `contains`).
 * Includes String scalars and enums, excludes IDs, sensitive fields, and system fields.
 * @param {import('./types.js').Field} field
 * @param {string} [modelName]
 */
export function isSearchable(field, modelName) {
	const sensitiveNames = getSensitiveFieldNames(modelName);
	if (field.isId) return false;
	if (sensitiveNames.has(field.name)) return false;
	if (isSystemField(field)) return false;
	if (field.kind === "enum") return true;
	return field.kind === "scalar" && field.type === "String";
}
