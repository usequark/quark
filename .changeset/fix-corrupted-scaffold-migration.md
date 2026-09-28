---
"@techstream/quark-create-app": patch
---

Fix three scaffold-breaking bugs that made `test:build` (and the nightly Scaffold Container Security job) fail

- **Corrupted initial migration.** `packages/db/prisma/migrations/20260202061128_initial/migration.sql` in the scaffold template began with Prisma's `Loaded Prisma config from prisma.config.js.` log line, captured because Prisma writes it to stdout and the diff was piped with `>`. Postgres rejected the migration with `42601 syntax error at or near "Loaded"`, so **every newly scaffolded project failed its first `db:migrate:deploy`**. `validate-template-migration.js` had been filtering that exact line out of its comparison, so it reported "matches the current schema" while shipping broken SQL — it now hard-fails on any non-SQL preamble, and a new `pnpm --filter @techstream/quark-create-app regen-migration` regenerates the file safely.
- **Invalid second build scenario.** `test-build.js` scaffolded with `--packages cms`, which the CLI rejects (`Invalid packages: cms`), so the scenario always aborted before testing anything. It now covers `pwa` instead.
- **PWA manifest conflict.** The `pwa` feature wrote `app/manifest.json` next to the base project's `app/manifest.js`, and Next.js failed the build with `Cannot find module for page: /manifest.webmanifest`. The feature now replaces `manifest.js` with the PWA variant.
