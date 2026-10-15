#!/usr/bin/env node

/**
 * release-version.mjs
 *
 * Runs `changeset version`, stamps ISO dates onto the new CHANGELOG headings,
 * and then re-syncs scaffold templates so the version bumps (and any source
 * changes) are reflected in the templates within the same release commit.
 *
 * The date stamp is the "releases carry dates" mechanism (see
 * `scripts/stamp-changelog-dates.mjs` for the rationale): Changesets emits no
 * dates, so without this step every new heading would land undated. It runs
 * here — inside the release workflow's `version` step — so the version PR
 * already carries the date, with no manual step to forget.
 *
 * The changesets/action executes the `version` script as a single command
 * without a shell, so `&&` chaining in the workflow YAML fails. This wrapper
 * keeps it a single executable while running all three steps.
 */

import { execSync } from "node:child_process";

execSync("pnpm changeset version", { stdio: "inherit" });
execSync("node scripts/stamp-changelog-dates.mjs", { stdio: "inherit" });
execSync("node packages/cli/scripts/sync-templates.js", { stdio: "inherit" });
