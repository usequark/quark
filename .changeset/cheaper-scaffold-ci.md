---
"@techstream/quark-create-app": patch
---

Stop paying for scaffolded projects' CI on changes that cannot break it

Every scaffolded project inherited three CI costs that bought nothing on most
commits, and one of them quietly removed a safety net.

- Docs-only and `docs/**` changes no longer trigger CI. Every README tweak was
  paying for a full monorepo install, a lint pass and a test run.
- The Windows job ran on every push and pull request, at the 2x Windows
  billing multiplier, purely to prove `pnpm install` resolves the lockfile -
  which the Linux jobs already cover. It is now `workflow_dispatch` only. The
  check is preserved, just not paid for by default.
- CI now declares `permissions: contents: read` and a `concurrency` group that
  cancels superseded runs.

`install-windows.yml` is added to the `TEMPLATE_ONLY` list so template sync
never overwrites it, matching the sibling workflow entries.
