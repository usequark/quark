/**
 * Pure formatting helpers — safe for Client Components (no Prisma / Node deps).
 */

/**
 * Format a monetary value using locale/currency from options or defaults.
 * @param {number|string} value
 * @param {{ maximumFractionDigits?: number, locale?: string, currency?: string }} [options]
 * @returns {string}
 */
export function formatCurrency(value, options = {}) {
	const {
		maximumFractionDigits = 0,
		locale = "en-US",
		currency = "USD",
	} = options;
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		maximumFractionDigits,
	}).format(Number(value));
}
