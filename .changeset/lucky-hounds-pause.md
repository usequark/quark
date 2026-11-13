---
"@usequark/quark-create-app": patch
---

Cap workflow runtime and cancel superseded CI runs in scaffolded projects

A stuck job is not free. A single hung job in the monorepo ran for six hours
before it was cancelled by hand, billing $2.16 for a run that should have been
capped at minutes. Every job in this repository now declares `timeout-minutes`,
and the scaffold template ships the same caps so new projects inherit them
instead of rediscovering the failure the hard way:

- `ci.yml`: lint 10, test 20, build 10, with
  `concurrency: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}`
  and `cancel-in-progress: true`, so a superseded pull-request run stops paying
  for itself while non-PR (push) runs each get a unique group and are never
  cancelled
- `release.yml`: 20 (no cancel-in-progress; deploys are not safe to interrupt)
- `install-windows.yml`: 10 (already present)
- `dependabot-auto-merge.yml`: 5

The monorepo mirrors this policy: CI jobs at 10, release at 20, and the two
small guard workflows at 10 and 5.
