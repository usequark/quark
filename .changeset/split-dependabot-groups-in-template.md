---
"@techstream/quark-create-app": patch
---

Split scaffolded projects' dependabot PRs by semver update type

The scaffold template grouped by `dependency-type` alone, so a project created
by the CLI got one PR bundling patch, minor and major bumps. That is how
bullmq 6's removal of `queue.client` reached this repo unnoticed inside a
35-package diff, shipping two silent production regressions.

The template now mirrors the monorepo config: majors get their own PR per
dependency type, so a breaking change is reviewed on its own. The scaffold's
`dependabot-auto-merge` workflow already only merges
`version-update:semver-patch`, so majors continue to require a human.

`dependabot-config.test.js` asserts both configs keep the split, so neither
can silently regress back to catch-all groups.
