---
"@techstream/quark-create-app": patch
---

Guard the dependabot auto-merge gate, not just the group split

The per-severity dependabot groups are already in place, and there is a test
asserting both configs keep them. That test only covers what a human *sees*.
It says nothing about what merges unattended, which is decided entirely by
`.github/workflows/dependabot-auto-merge.yml`.

That gate is correct today — it keys on
`update-type == 'version-update:semver-patch'`, so minors and majors need a
human. But nothing asserted it, which leaves the most consequential line in the
dependency pipeline one careless edit away from auto-merging majors. The
reference is the bullmq 6 break: `queue.client` was removed in a version
Dependabot presented as a routine bump, and the two silent regressions that
followed shipped inside a 35-package PR.

Four new tests, two per config, covering the monorepo and the scaffold
template. Negative-tested by stripping the `if: steps.meta.outputs.update-type`
condition from each file in turn: each removal fails exactly one test.
