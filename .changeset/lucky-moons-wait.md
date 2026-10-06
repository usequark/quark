---
"@usequark/quark-create-app": patch
---

Collect `*.integration-test.js` in the test runner, so component render tests
actually run in CI.

`scripts/run-tests.mjs` collected only files ending in `.test.js`. The
integration suites are named `*.integration-test.js` — a hyphen, not a dot —
so none of them were picked up. Two suites in `packages/ui` were affected
(`form-field.integration-test.js`, 10 tests; `lightbox.integration-test.js`,
5 tests). Every one passed when run by hand and none had ever run in CI, so a
green pipeline was reporting on a subset of the tests in the repo.

The filename split is now deliberate and documented in the collector.
`--exclude=integration.test.js` keeps its meaning: it matches
`apps/web/src/app/api/integration.test.js` and not the hyphenated files, which
is why widening the glob does not drag the API integration suite back in.

Both suites also needed a teardown fix to survive being collected. Each test
called `root.unmount()` outside `act()`, so React flushed the unmount after the
`after()` hook had already deleted the `window`/`document` globals — surfacing
as `ReferenceError: window is not defined` once the file was run without
`--test-force-exit`. The 15 tests all passed while the file itself still exited
non-zero. Unmounts are now wrapped in `act()` and detach their container.

`packages/ui` counts go from 110 to 125 tests. The runner is also synced into
scaffolded projects, where the same gap existed against their own
`*.integration-test.js` files.