/**
 * @techstream/quark-core - Query Builder
 * Builds Prisma where/orderBy clauses from query parameters
 * with validation and sanitization.
 */

/**
 * @typedef {Object} QueryBuilderOptions
 * @property {string[]} [searchFields] - Fields to search across
 * @property {string[]} [sortableFields] - Fields that can be sorted
 * @property {string[]} [filterableFields] - Fields that can be filtered
 */

/**
 * Supported filter operators
 */
const OPERATORS = {
	eq: "equals",
	ne: "not",
	gt: "gt",
	gte: "gte",
	lt: "lt",
	lte: "lte",
	contains: "contains",
	startsWith: "startsWith",
	endsWith: "endsWith",
	in: "in",
};

/**
 * Query builder for constructing Prisma where/orderBy clauses.
 */
export class QueryBuilder {
	/**
	 * @param {QueryBuilderOptions} options
	 */
	constructor(options = {}) {
		this.searchFields = options.searchFields || [];
		this.sortableFields = options.sortableFields || [];
		this.filterableFields = options.filterableFields || [];
		this.filters = [];
		this.searchTerm = null;
		this.sortField = null;
		this.sortDirection = "asc";
	}

	/**
	 * Add a filter condition.
	 * @param {string} field - Field name
	 * @param {string} operator - Operator (eq, ne, gt, gte, lt, lte, contains, startsWith, endsWith, in)
	 * @param {any} value - Filter value
	 * @returns {QueryBuilder}
	 */
	filter(field, operator, value) {
		if (!this.filterableFields.includes(field)) {
			throw new Error(
				`Field "${field}" is not filterable. Allowed: ${this.filterableFields.join(", ")}`,
			);
		}

		if (!OPERATORS[operator]) {
			throw new Error(
				`Operator "${operator}" is not supported. Allowed: ${Object.keys(OPERATORS).join(", ")}`,
			);
		}

		this.filters.push({ field, operator, value });
		return this;
	}

	/**
	 * Add a full-text search across multiple fields.
	 * @param {string} term - Search term
	 * @returns {QueryBuilder}
	 */
	search(term) {
		if (!term || typeof term !== "string") {
			return this;
		}

		if (this.searchFields.length === 0) {
			throw new Error("No search fields configured for this query");
		}

		this.searchTerm = term.trim();
		return this;
	}

	/**
	 * Set sort field and direction.
	 * @param {string} field - Field name
	 * @param {"asc" | "desc"} [direction="asc"] - Sort direction
	 * @returns {QueryBuilder}
	 */
	sort(field, direction = "asc") {
		if (!this.sortableFields.includes(field)) {
			throw new Error(
				`Field "${field}" is not sortable. Allowed: ${this.sortableFields.join(", ")}`,
			);
		}

		if (direction !== "asc" && direction !== "desc") {
			throw new Error('Sort direction must be "asc" or "desc"');
		}

		this.sortField = field;
		this.sortDirection = direction;
		return this;
	}

	/**
	 * Build Prisma where clause.
	 * @returns {Object} Prisma where object
	 */
	toWhere() {
		const conditions = [];

		// Add filter conditions
		for (const { field, operator, value } of this.filters) {
			const prismaOp = OPERATORS[operator];

			if (operator === "in") {
				// Special handling for "in" operator - value should be an array
				const values = Array.isArray(value) ? value : [value];
				conditions.push({ [field]: { in: values } });
			} else if (operator === "ne") {
				// "not" operator wraps the value
				conditions.push({ [field]: { not: value } });
			} else {
				conditions.push({ [field]: { [prismaOp]: value } });
			}
		}

		// Add search condition
		if (this.searchTerm) {
			const searchConditions = this.searchFields.map((field) => ({
				[field]: { contains: this.searchTerm, mode: "insensitive" },
			}));
			conditions.push({ OR: searchConditions });
		}

		// Return combined conditions
		if (conditions.length === 0) {
			return {};
		}
		if (conditions.length === 1) {
			return conditions[0];
		}
		return { AND: conditions };
	}

	/**
	 * Build Prisma orderBy clause.
	 * @returns {Object | undefined} Prisma orderBy object
	 */
	toOrderBy() {
		if (!this.sortField) {
			return undefined;
		}
		return { [this.sortField]: this.sortDirection };
	}

	/**
	 * Reset all filters, search, and sort.
	 * @returns {QueryBuilder}
	 */
	reset() {
		this.filters = [];
		this.searchTerm = null;
		this.sortField = null;
		this.sortDirection = "asc";
		return this;
	}
}

/**
 * Factory function to create a new QueryBuilder.
 * @param {QueryBuilderOptions} options
 * @returns {QueryBuilder}
 */
export function createQueryBuilder(options) {
	return new QueryBuilder(options);
}
