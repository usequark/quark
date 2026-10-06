---
"@usequark/quark-create-app": patch
---

Treat an empty test suite as a success in scaffolded projects

`scripts/run-tests.mjs` exited 1 when it collected zero `*.test.js` files. A
freshly scaffolded project ships no test files, so `pnpm test` failed for
`apps/web` and `apps/worker`, which failed the `pre-push` hook installed by
`scripts/prepare.js`, which made the very first `git push` impossible without
`--no-verify`. The same failure would hit CI on any newly scaffolded repo.

The runner now exits 0 and logs `No test files found in: <roots> - nothing to
run.`, matching the behaviour of stock `node --test`, which already exits 0 when
it matches no files.