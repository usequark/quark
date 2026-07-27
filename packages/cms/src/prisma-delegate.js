import { AppError } from "@techstream/quark-core/errors";

/**
 * Internal helper: returns the Prisma delegate for a given model name.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} model - Pascal-case Prisma model name (e.g. "Page", "Post")
 * @returns {object} Prisma model delegate
 */
export function getDelegate(prisma, model) {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	const delegate = prisma[key];
	if (!delegate || typeof delegate.findUnique !== "function") {
		throw new AppError(
			`Unknown Prisma model: "${model}"`,
			500,
			"UNKNOWN_MODEL",
		);
	}
	return delegate;
}
