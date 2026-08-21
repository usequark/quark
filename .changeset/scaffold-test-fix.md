---
"@techstream/quark-create-app": patch
---

fix(scaffold): scaffolded web tests fail out of the box

A freshly scaffolded project's `pnpm test` failed because the web test script
(`node --test 'src/**/*.test.js'`) was missing the `--experimental-test-module-mocks`
flag and ran integration tests that the monorepo excludes. The scaffold now ships
`scripts/run-tests.mjs` (matching the monorepo runner) and the web test script uses
`node ../../scripts/run-tests.mjs src --exclude=integration.test.js`. Scaffolded web
tests pass 56/56 and db tests 52/52.
