---
"@usequark/quark-create-app": patch
---

Fix CLI git-init flag, repair the CLI flag test suite, and remove dead tests.

`QUARK_FORCE_GIT_INIT=true` was documented and checked inside `initializeGit()`, but the enclosing-repository guard at the Step-11 call site short-circuited before that check ran, so the flag was a no-op. The guard now defers to the flag.

`test-flags.js` (19 tests) is now wired into the CI test chain. It was previously unreferenced, and six of its assertions were stale: they expected a bookings skill and other scaffolding that no longer ships. Those assertions were repaired against current behavior.

Removed `test-e2e.js`, which reimplemented scaffolding with `fs.copy` instead of invoking the CLI, so it could not detect any CLI regression; the real lifecycle coverage lives in `test-e2e-full.js`. Replaced the tautological `page.test.js` (its assertions passed no matter what the page rendered) with a source-level test that fails when the home page's github or npm links are dropped, matching the technique already used by `manifest.test.js`.
