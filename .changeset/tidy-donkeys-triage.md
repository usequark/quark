---
"@usequark/quark-create-app": patch
---

Triage dependency vulnerabilities: 21 advisories down to 3.

- Remove the auto-installed `nodemailer@7.0.13` optional peer that `next-auth` and
  `@auth/core` pull in, clearing 13 advisories. Nothing uses Auth.js's Nodemailer
  provider, so the peer edge is deleted rather than forced past its declared range.
- Override `qs` to `>=6.16.0` via `stripe`, inside the range `stripe` itself declares.
- Override `uuid` to `>=11.1.1`. `xcode@3.0.1` calls only `v4()`, and that call site was
  exercised against a real generated pbxproj to confirm it still returns a valid ID.
- Refresh `shell-quote` and `source-map-js` in the lockfile; no override needed.
- `pnpm standards` now fails the build if anything imports
  `next-auth/providers/nodemailer`, since removing that peer edge is what makes it
  unresolvable. The message names the fix, and 8 tests in
  `scripts/check-standards.test.mjs` keep it from firing on unrelated code.

Three advisories remain in the Expo mobile build toolchain and are documented as
accepted risks in `docs/dependency-audit.md`: `node-forge` and `braces`, which have no
patched release at all, and `decode-uri-component`, whose fix is ESM-only and would
break the CommonJS `query-string` that depends on it.

Scaffolded projects inherit these overrides, so they audit clean.