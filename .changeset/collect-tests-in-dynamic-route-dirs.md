---
"@usequark/quark-create-app": patch
---

Fix `pnpm test` silently skipping every test file in a dynamic route directory.

Next.js dynamic route segments are directories named `[id]` or `[...slug]`.
`run-tests.mjs` collects test files with `readdirSync` — so it found them — then
handed the paths to `node --test`, which matches its file arguments as globs. A
literal `[id]` is read as a character class matching a single `i` or `d`, so the
path matched nothing.

The failure was silent in the worst way: `node --test` reported zero tests and
exited `0`. The empty-suite guard in the runner never fired, because collection
had already succeeded and the drop happened one step later. A suite that had
never run looked exactly like a suite that had.

Affected: any test co-located in a dynamic segment. In this repo that was
`apps/web/src/app/api/files/[id]/route.test.js` — 14 tests — plus `users/[id]`
and `[...nextauth]`, which have no tests for the same reason.

The runner now escapes `[` and `]` before passing paths on, and four tests pin
the behaviour, including a mutation test proving the escape is load-bearing.