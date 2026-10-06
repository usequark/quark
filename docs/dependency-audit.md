# Dependency vulnerability triage

Status as of this change: **21 advisories -> 3.** This document explains what was fixed,
what was deliberately left, and why.

Severity labels come from the advisory database. **Exposure** is a separate question and is
recorded per finding below, because most of the original count was toolchain code that never
ships.

Reproduce with:

```bash
pnpm audit
pnpm audit --json
```

`gh api repos/usequark/quark/dependabot/alerts` returns 403 from CI, so `pnpm audit` is the
source of truth.

## Fixed

| Package | Advisories | Severity | Fix | Exposure |
|---|---|---|---|---|
| `nodemailer` 7.0.13 | 13 | high x3, moderate x9, low x1 | Peer edge removed | none - dead code |
| `qs` 6.15.3 | 2 | moderate | `overrides`, inside `stripe`'s own `^6.11.0` | production |
| `shell-quote` 1.10.0 | 1 | critical | lockfile refresh | dev only |
| `source-map-js` 1.2.1 | 1 | high | lockfile refresh | build only |
| `uuid` 7.0.3 | 1 | moderate | `overrides`, justified below | build only |

### nodemailer - 13 advisories, zero real exposure

This was the largest single block in the audit and the least dangerous of them.

`packages/core` declares `nodemailer: ^10.0.10` and resolves 10.0.10, which is past every
advisory's patched range. The vulnerable copy was a **second, older** 7.0.13 pulled in as an
auto-installed **optional peer**:

```
apps/web -> next-auth@5.0.0-beta.32 -> @auth/core@0.41.3
                                       peerDependencies: { nodemailer: "^7.0.7 || ^8.0.5" }
                                       peerDependenciesMeta: { nodemailer: { optional: true } }
```

Two facts make this unfixable by upgrading:

1. Every nodemailer advisory needs `>=10.0.6`. No version satisfying `^7.0.7 || ^8.0.5` is
   patched, so there is no in-range upgrade.
2. `@auth/core@0.41.3` is the newest published release and `@auth/prisma-adapter@2.11.3` is
   also current. Neither has widened the range.

Rather than force nodemailer two majors past a range its author chose, we remove the peer edge
entirely, which deletes 7.0.13 from the tree:

```yaml
"next-auth>nodemailer": "-"
"@auth/core>nodemailer": "-"
```

This is safe because the provider is never used:

- `apps/web/src/lib/auth.js` configures `CredentialsProvider`, `GithubProvider` and
  `GoogleProvider` only.
- `@auth/core`'s index never imports nodemailer statically. Only
  `@auth/core/providers/nodemailer.js` does, and nothing imports that module.
- Outgoing mail goes through `@usequark/quark-core` (`src/email.js`), which depends on
  nodemailer `^10.0.10` directly.

### The override is guarded, not just documented

Deleting the peer edge means `next-auth/providers/nodemailer` stops resolving. Left alone,
that failure is late and opaque: the provider does
`import { createTransport } from "nodemailer"` at module scope, so it surfaces as
`ERR_MODULE_NOT_FOUND` on the next server start, with nothing pointing at the override.

`scripts/check-standards.mjs` now fails the build if any source file imports that provider,
and names the fix in the error. It runs in CI via `pnpm standards`, and covers the monorepo
and the scaffold template.

The guard matches every spelling that resolves the module - static default, bare
side-effect, re-export, `await import(...)`, `import(...).then(...)` and `require(...)`,
including single quotes, template literals and a specifier wrapped onto its own line. It
deliberately does *not* fire on other `next-auth/providers/*` imports, on a bare `nodemailer`
import, on an identifier that merely contains `import` or `require`, or on a comment that
mentions the path. `scripts/check-standards.test.mjs` has 20 cases covering both directions,
because a guard that misses a form reads as protection while letting the breakage through.

### qs - the one production-path fix that was safe

`stripe@17.7.0` declares `qs: ^6.11.0`. Both advisories need `>=6.16.0`, which is inside that
range, so the override does not violate anything stripe declared. `pnpm update` cannot make
this move because qs is not a direct dependency of any workspace package.

```yaml
qs@>=6.14.2 <=6.15.3: ">=6.16.0"
```

### shell-quote and source-map-js - no override needed

Both were stale lockfile entries that a plain `pnpm update -r` moved forward, staying inside
their parents' declared ranges. **No override was added for either.** The critical severity on
`shell-quote` was misleading: it is a root devDependency reached through
`@changesets/cli -> launch-editor`, and the advisory is command injection in a local
editor-launcher on a developer machine, not in anything deployed.

### uuid - four majors, justified and verified

`xcode@3.0.1` declares `uuid: ^7.0.3`; the advisory needs `>=11.1.1`. This is the one override
that leaves a declared range, so it was checked rather than assumed:

- `xcode` only calls `uuid.v4()`. That is the sole call site, at
  `lib/pbxProject.js:90`, inside `generateUuid()`.
- Verified against the **real** call site, not just the API shape. After
  `expo prebuild --platform ios` produced `apps/mobile/ios/Quark.xcodeproj/project.pbxproj`,
  the audited chain was driven directly:

  ```
  pbxProject = require('.../xcode/lib/pbxProject.js')   # requires uuid at module scope
  proj = new pbxProject('ios/Quark.xcodeproj/project.pbxproj')
  proj.parseSync()                                      # 32 UUIDs parsed
  proj.generateUuid()  ->  '95C8FFC7A2D447F4B866B875'   # 24-hex uppercase: true
  ```

  `generateUuid()` is the function that would break if the override were wrong, and it
  returns a correctly formatted 24-character uppercase hex ID with uuid 14.0.2 resolved.
- The path is build-time only, reached through `@expo/config-plugins` when generating native
  projects. Nothing about it ships in a JS bundle.

## Not fixed - documented accepts

These three remain. None has a fix we can take without breaking something, and all three sit
in `apps/mobile`'s Expo build toolchain. **None of them is shipped application code.**

### decode-uri-component 0.2.2 - moderate

- **Path:** `apps/mobile -> expo-router -> query-string@7.1.3 -> decode-uri-component`
- **Fix available but rejected:** the advisory needs `>=0.5.0`. `query-string@7.1.3` declares
  `^0.2.2` and is CommonJS; it does `const decodeComponent = require('decode-uri-component')`
  and then calls it as a function. `decode-uri-component@0.5.0` is ESM-only, so under
  `require(esm)` it returns a namespace object. Verified directly: the direct call fails with
  `TypeError: m is not a function`, while `m.default(...)` works. Forcing the upgrade would
  break `query-string` at runtime.
- **Why query-string cannot move:** 7.1.3 is the newest 7.x, and `expo-router@57.0.23` pins it.
- **Exposure:** dev/build only. Reached via `@expo/router-server` while Expo builds or serves
  the app. The advisory is a DoS via exponential decoding of malformed percent-encoding in a
  URL query string.
- **Unblocked by:** `query-string` bumping to a version that drops the dependency, or a
  patched `decode-uri-component` release that keeps a CommonJS entry point.

### node-forge 1.4.0 - high

- **Path:** `apps/mobile -> expo@57.0.25 -> @expo/cli@57.0.27 -> node-forge@1.4.0` (also via
  `@expo/code-signing-certificates@0.0.6`)
- **Patched versions: `<0.0.0`.** There is no fixed release. 1.4.0 is the newest version
  published.
- **Advisory:** RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm
  elements (GHSA-86w9-cpqp-85rv).
- **Exposure:** build-time only, and only while Expo generates iOS signing assets. Not in any
  shipped JS bundle.
- **Recommendation:** accept and revisit when `@expo/cli` moves off `node-forge@1.4.0`.
  **Do not** force an override: there is no version to force it to.

### braces 3.0.3 - high

- **Path:** `apps/mobile -> expo@57.0.25 -> @expo/cli -> @expo/metro-file-map ->
  micromatch@4.0.8 -> braces@3.0.3`
- **Patched versions: `<0.0.0`.** No fixed release exists; 3.0.3 is the newest version.
- **Advisory:** stack-exhaustion DoS through deeply nested glob patterns
  (GHSA-vfj7-8cjw-p6xm).
- **Exposure:** build-time only. `micromatch` matches file paths against developer-authored
  glob patterns at bundle time. Reaching the DoS needs a pathological pattern authored in the
  repo, not attacker-controlled input.
- **Recommendation:** accept. Reachable only if `@expo/metro-file-map` moves to a `micromatch`
  release whose `braces` range admits a fixed version.

## Re-checking after an upgrade

Run `pnpm audit`. If any of the three remaining advisories disappears, it moved upstream and
this document should be updated. Note that `pnpm audit` reads the lockfile, so a stale
`.pnpm` directory can make a resolved tree look unfixed - `rm -rf node_modules && pnpm install`
if a count looks stale.

## Known unrelated breakage: the mobile bundle does not build

Found while verifying the `uuid` override above. **Not caused by any override in this
document** - it reproduces on `origin/main` with a clean lockfile.

`expo export` fails:

```
iOS Bundling failed
Error: Cannot find module '.../react-native/rn-get-polyfills'
```

Cause: `@expo/metro-config@57.x` calls
`require(<react-native>/rn-get-polyfills)()` in its Metro `getPolyfills` hook.
react-native shipped that file through 0.86 and **dropped it in 0.87** - the published
`react-native@0.87.1` tarball contains zero occurrences of it. `apps/mobile` pins
`react-native: 0.87.1`, but Expo SDK 57 pins `0.86.3`, which is what
`npx expo install --check` reports as expected.

Narrower than it looks: `expo prebuild` works fine on 0.87.1, because it never reaches the
Metro polyfill hook. Only the bundler path breaks.

Downgrading to `0.86.3` was tested and does fix it - `expo export` produced a complete iOS
bundle (`entry-8badf830eadac4e04fbda158e097aeea.hbc`, 2.9MB). It was left undone here because
it is a dependency decision outside the scope of an advisory audit: 0.86.3 is what Expo asks
for, but taking it means reverting a Dependabot bump and re-testing the mobile app on an
older RN. `expo install --check` lists 11 further packages that want the same treatment.

Related: `pnpm build:mobile` invokes a script the mobile package does not have
(`pnpm --filter @usequark/quark-mobile export` -> "None of the selected packages has an
'export' script"), so it has never worked. Also pre-existing.

## Deliberately not done

- No `auditConfig.ignoreCves` or `audit.level` change. The three remaining advisories are
  reported honestly rather than silenced.
- No Dependabot alert dismissal.
- No application-level mitigation code for any advisory.