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

export {};
