/**
 * Admin panel configuration.
 *
 * This file is scaffolded into your project - edit it freely to customise
 * the admin UI for your specific models and requirements.
 */

export const adminConfig = {
	/** Title displayed in the admin header and sidebar */
	title: "Admin",

	/** Number of records shown per page in list views */
	pageSize: 25,

	/**
	 * Per-model overrides. Key is the Prisma model name (case-sensitive).
	 *
	 * @type {Record<string, {
	 *   readOnly?: boolean,
	 *   label?: string,
	 *   hiddenFields?: string[],
	 *   fkTargets?: Record<string, string>,
	 * }>}
	 *
	 * @example
	 * modelOverrides: {
	 *   AuditLog: { readOnly: true },
	 *   User: { hiddenFields: ['password'] },
	 * }
	 *
	 * Use `fkTargets` when an FK field name by convention
	 * (e.g. `leadId` → "Lead") doesn't match the actual model.
	 * User: { fkTargets: { leadId: "User" } }
	 */
	modelOverrides: {
		// NextAuth internal models - shown read-only to prevent accidental changes
		Account: { readOnly: true },
		Session: { readOnly: true },
		VerificationToken: { readOnly: true },
		// Audit logs are immutable by design
		AuditLog: { readOnly: true },
	},
};
