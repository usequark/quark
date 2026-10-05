/**
 * .gitignore content for scaffolded projects.
 *
 * This lives in a module rather than only as `base-project/.gitignore` because
 * **npm strips every `.gitignore` out of published tarballs**, unconditionally,
 * with no opt-out. The template copy of the file therefore never reaches anyone
 * installing `@usequark/quark-create-app` from npm - only someone running the CLI
 * from a git checkout sees it. Scaffolded projects were consequently shipping
 * with no `.gitignore` at all, while `.dockerignore`, `.nvmrc` and `.env.example`
 * all arrived normally, because npm strips only `.gitignore` and `.npmrc`.
 *
 * That matters: the scaffolder runs `git init`, so the first `git add .` in a
 * generated project would stage `node_modules/`, `.next/`, and `.env` - which
 * `scripts/prepare.js` populates with real credentials.
 *
 * `generate-templates.js` writes the in-repo copy from this same export, so the
 * file a contributor sees and the file a user gets cannot drift apart.
 */
export const SCAFFOLD_GITIGNORE_ENTRIES = [
	"# dependencies",
	"node_modules/",
	"",
	"# environment",
	".env",
	".env.local",
	".env.*.local",
	"",
	"# next.js",
	".next/",
	"out/",
	"",
	"# build artifacts",
	"dist/",
	"build/",
	"",
	"# testing",
	"coverage/",
	"",
	"# misc",
	".DS_Store",
	"*.log",
	".quark-auto-clean.json",
	"",
	"# turbo",
	".turbo/",
	"",
	"# prisma",
	"packages/db/src/generated/",
	"",
	"# uploads",
	"**/uploads/",
];

export const SCAFFOLD_GITIGNORE = `${SCAFFOLD_GITIGNORE_ENTRIES.join("\n")}\n`;
