---
"@techstream/quark-create-app": patch
---

Stop pinning rrweb's version in test-build, and correct the declared Node floor

`test-build.js` asserted `dependencies.rrweb === "2.1.6"` while its own error
message said the dependency was "missing". The intent is presence, so any rrweb
bump broke the build for a non-reason - it already did once on a dependency
PR. It is now a presence check, still rejecting a missing, null or
devDependencies-only rrweb.

`engines.node` was `>=22`, which is looser than what the dependency tree
actually requires. The binding constraint is not `commander@15` (>=22.12.0) as
previously assumed, but `react-native@0.87.1` (^22.13.0), so the floor is now
`>=22.13.0`. CI (`node-version: 22`) and the Dockerfiles (`node:22`) both
resolve to a current 22.x, so nothing needed pinning.
