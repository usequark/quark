---
"@usequark/quark-create-app": patch
---

Move scaffolded workflow actions off deprecated Node.js 20 runtimes

Scaffolded projects shipped workflows pinning `actions/checkout@v4`,
`actions/setup-node@v4`, and `pnpm/action-setup@v4`, all of which declare
`runs.using: node20`. GitHub is forcing these onto the Node.js 24 runtime and
annotating every run with a Node 20 deprecation warning, so every newly
scaffolded project started its life with deprecation noise in the log.

Bumped to the Node 24 line: `actions/checkout@v6`, `actions/setup-node@v6`,
`pnpm/action-setup@v5`, `dependabot/fetch-metadata@v3`, and
`softprops/action-gh-release@v3`.

Four of those are runtime-only moves, confirmed against each action's release
notes rather than assumed. Two of them cross majors that carry behaviour
changes, both of which are inert for a scaffolded pnpm project:

- `setup-node` v5 added automatic package-manager caching whenever a
  `packageManager` field is present, and v6 narrowed that automatic caching to
  npm alone. Every generated workflow already sets `cache: pnpm` explicitly and
  the scaffold pins `pnpm@10.12.1`, so generated projects stay outside the
  automatic-cache path and cache exactly as before. A generated workflow that
  ever drops the explicit `cache:` input can opt out with
  `package-manager-cache: false`.
- `checkout` v6 persists credentials to a separate file rather than writing
  them into `.git/config`. No generated workflow reads authentication back out
  of `.git/config`, so nothing depends on the old location.

`pnpm/action-setup` is pinned to v5 rather than v6 because v5 exists solely to
move the action to Node 24, whereas v6 only adds pnpm v11 support, which the
`pnpm@10.12.1` pin does not use. `upload-artifact` moves v4 -> v6 for the same
reason: v5 was already Node 24-capable but still defaulted to the Node 20
runtime, so v6 is the first release that actually needs pinning.

Also added a `github-actions` block to the scaffolded `.github/dependabot.yml`.
Action pins previously had no automation tracking them at all, and because
GitHub reports a stale runtime only as a log annotation rather than a failing
check, nothing in CI ever prompted the bump. That is the reason this drift
accumulated in the first place.
