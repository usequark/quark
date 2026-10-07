import chalk from "chalk";

/**
 * Warn when the `jobs` feature was not selected for a scaffold.
 *
 * `File.uploadedBy` is `onDelete: SetNull`, so deleting a user orphans their file
 * rows rather than removing them. `CLEANUP_ORPHANED_FILES` is the only thing that
 * sweeps those rows and their blobs, and it runs in the worker — which is scaffolded
 * only alongside `jobs`. Declining `jobs` therefore leaves orphaned rows and blobs
 * accumulating indefinitely, with nothing reading `uploadedById = null` to surface
 * them.
 *
 * Said at the point of the decision rather than discovered in production. It is a
 * warning and not a refusal: `jobs` is optional and a project with no uploads has no
 * orphan problem.
 *
 * @param {string[]} features - Resolved feature list for the scaffold.
 * @returns {boolean} Whether the warning was printed.
 */
export function warnIfJobsOmitted(features, log = console.log) {
	if (features.includes("jobs")) return false;

	log(
		chalk.yellow(
			`    ⚠ Background jobs omitted: the orphaned-file cleanup will not exist.`,
		),
	);
	log(
		chalk.dim(
			`      Deleting a user leaves their uploaded files orphaned in storage — the schema\n      keeps the rows rather than removing them — and without a worker nothing sweeps them.`,
		),
	);
	log(
		chalk.dim(
			`      Add it later with: npx @usequark/quark-create-app add jobs\n`,
		),
	);
	return true;
}
