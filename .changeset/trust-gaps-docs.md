---
"@usequark/quark-create-app": patch
---

Docs-only trust gaps (no behaviour change): `README.md` positioning line now claims the updatable core instead of "framework"; `apps/web/src/lib/auth.js` documents why `PrismaAdapter` stays (OAuth `Account` rows) and marks the `Session` queries app-owned under the JWT strategy (mirrored in `packages/db/src/queries.js`); `docs/SECURITY_FEATURES.md` records that `userUpdateSchema` omits `role` as a privilege boundary. Template copies synced.
