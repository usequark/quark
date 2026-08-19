#!/usr/bin/env node

/**
 * release-version.mjs
 *
 * Runs `changeset version` and then re-syncs scaffold templates so the
 * version bumps (and any source changes) are reflected in the templates
 * within the same release commit.
 *
 * The changesets/action executes the `version` script as a single command
 * without a shell, so `&&` chaining in the workflow YAML fails. This wrapper
 * keeps it a single executable while running both steps.
 */

import { execSync } from "node:child_process";

execSync("pnpm changeset version", { stdio: "inherit" });
execSync("node packages/cli/scripts/sync-templates.js", { stdio: "inherit" });
