/**
 * Generic CRUD operations via dynamic Prisma client model access.
 *
 * All functions accept a `prisma` client as the first parameter to avoid
 * circular imports and make testing straightforward.
 */

/**
 * Fetch paginated records for a model.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model - Prisma model name (e.g. "User", "AuditLog")
 * @param {{ skip?: number, take?: number, orderBy?: object, where?: object }} [options]
 * @returns {Promise<{ records: object[], total: number, skip: number, take: number }>}
 */
export async function findMany(prisma, model, options = {}) {
	const {
		skip = 0,
		take = 25,
		orderBy = { createdAt: "desc" },
		where,
	} = options;
	const delegate = getDelegate(prisma, model);
	const args = { skip, take, orderBy };
	if (where) args.where = where;
	const [records, total] = await Promise.all([
		delegate.findMany(args),
		delegate.count(where ? { where } : undefined),
	]);
	return { records, total, skip, take };
}

/**
 * Fetch a single record by its ID field.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function findById(prisma, model, id) {
	return getDelegate(prisma, model).findUnique({ where: { id } });
}

/**
 * Create a new record.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createRecord(prisma, model, data) {
	return getDelegate(prisma, model).create({ data });
}

/**
 * Update a record by ID.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateRecord(prisma, model, id, data) {
	return getDelegate(prisma, model).update({ where: { id }, data });
}

/**
 * Delete a record by ID.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function deleteRecord(prisma, model, id) {
	return getDelegate(prisma, model).delete({ where: { id } });
}

/**
 * Count all records for a model.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model
 * @returns {Promise<number>}
 */
export async function countRecords(prisma, model) {
	return getDelegate(prisma, model).count();
}

/**
 * Get the Prisma model delegate by model name.
 * Handles case normalization: "User" → prisma.user, "AuditLog" → prisma.auditLog
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model
 */
function getDelegate(prisma, model) {
	// Prisma delegates use lowerCamelCase: User → user, AuditLog → auditLog
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	const delegate = prisma[key];
	if (!delegate || typeof delegate.findMany !== "function") {
		throw new Error(`Unknown Prisma model: "${model}"`);
	}
	return delegate;
}
