---
"@techstream/quark-create-app": patch
---

Bump chalk 5→6, commander 14→15, execa 9→10 and @expo/vector-icons 14→15

Split out of the 35-package dependabot PR by the semver-aware group config so
each major gets reviewed on its own.

All four are ESM-only, which this repo already is, and all require Node ≥22
(commander ≥22.12.0); the pinned `node:22-alpine` image resolves to 22.23.3.

Verified rather than assumed:

- **chalk** — all 12 `chalk.*` call sites work, including `chalk.red.bold`
  chaining; emits correct ANSI under `FORCE_COLOR` and plain text when piped.
- **commander** — real `quark --help` and `--version` invocations render.
- **execa** — `test:build` completes both scenarios (default and pwa) end to
  end: scaffold, install, migrate, and Docker build.
- **@expo/vector-icons** — the `Ionicons` export chain and the
  `name`/`size`/`color` props are unchanged; v15 loads icon fonts lazily.
  Note the mobile app has no test or typecheck job in CI, so this one is not
  covered by automation.
