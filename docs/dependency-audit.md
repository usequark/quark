# Dependency vulnerability triage

Status as of the original triage: **21 advisories -> 3.** This document explains what was fixed,
what was deliberately left, and why.

Since then: **6 Next.js advisories -> 0**, fixed by upgrading `16.3.6` to `16.3.8`. See
[Next.js](#nextjs---6-advisories-fixed-by-upgrade) below.

Re-checked **2026-11-09**: a wave of new advisories landed in the registry database after the
2026-10-12 pass (43 reported, 40 unaccepted - CI on `main` went red on the audit gate at the
2026-11-07 release merge). Of those, **36 were fixed in-tree** (version bumps and same-major
overrides, listed under [Fixed](#fixed) below) and **one was withdrawn upstream** (`braces`
GHSA-vfj7 - no new release exists, the advisory simply no longer flags `braces@3.0.3`). The
standing accepted count is now **6**: the original `decode-uri-component` entry plus five new
documented accepts (`decode-uri-component` second advisory, `zod`, `glob`, `minimatch`,
`deepmerge`), each with its evidence under [Not fixed](#not-fixed---documented-accepts).

Re-checked **2026-10-12** against the GitHub advisory database and the npm registry: the three
open Dependabot alerts are the same three, `pnpm audit` still reports exactly three advisories
and no more, and none of them has become fixable in the meantime. Each entry under
[Not fixed](#not-fixed---documented-accepts) carries its own re-verified date and evidence, and
[Re-checked 2026-10-12](#re-checked-2026-10-12---no-fix-became-reachable) records why no fix is
reachable today. That pass also **corrected the exposure of `decode-uri-component`**: it is
runtime-reachable, not build-toolchain-only.

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

### The 2026-11-09 wave - 36 advisories, fixed in-tree

The registry published a large batch of advisories after the 2026-10-12 pass. None of them was
accepted unless fixing it would break something: everything below moved to a patched version.

| Package | From -> to | Advisories cleared | How |
|---|---|---|---|
| `next` | 16.3.8 -> 16.4.1 | 3 (2 critical, 1 high) | manifest bump (`apps/web`, `packages/ui`), synced to templates |
| `nodemailer` | 10.0.10 -> 10.4.0 | 5 moderate | floor `^10.1.4` in `packages/core` |
| `node-forge` | 1.4.0 -> 1.4.3 | 12 (incl. GHSA-86w9, retired from the allowlist) | override `node-forge@<=1.4.0: ">=1.4.1"` - inside `@expo/cli`'s `^1.3.3` |
| `undici` | 8.11.2 -> 8.12.2 | 8 (4 high, 4 moderate) | override, same major, dependents declare `^8.x` |
| `fast-uri` | 4.2.1 -> 4.2.3 | 4 (1 moderate, 3 low) | override floor raised to `>=4.2.3`, same major |
| `launch-editor` | 2.14.1 -> 2.14.2 | 3 (1 high, 2 moderate) | override, same major |
| `qs` | 6.16.0 -> 6.16.1 | 1 moderate | existing override floor raised (`<=6.16.0` -> `>=6.16.1`), inside `stripe`'s `^6.11.0` |

`zod` also moved `4.6.5 -> 4.6.7` (floor `^4.6.6`) but cleared no advisory on its own: the one
remaining `zod` advisory is still reported through Expo's `zod@3.25.76` - see the accept entry
below.

The three critical/high `next` advisories (unauthenticated RCE in Image Optimization and
`use cache`, DoS in App Router) are production-reachable in scaffolded apps, so they were never
candidates for the allowlist. `apps/web` and `packages/ui` both move to `16.4.1`, and
`sync-templates` propagates the bump so new apps do not ship the vulnerable pin.

### node-forge - 12 advisories, fixed by override (retired from the allowlist)

The old accept entry for `node-forge` GHSA-86w9 is gone: an upstream fix landed. The override

```yaml
node-forge@<=1.4.0: ">=1.4.1"
```

resolves 1.4.3 (inside `@expo/cli`'s declared `^1.3.3`, so nothing outside a declared range is
forced) and clears eleven advisories outright - GHSA-4642, 6wvx, 525v, 7wch, h6cr, 4487, 5cwg,
jc66, 8hrf, hqq3, 5x38 - plus GHSA-86w9 itself, which the registry now marks fixed in 1.4.x.
The build-time exposure analysis below still holds (iOS code signing only, never bundled); it is
kept because it explains why the override was safe to take without a runtime test.

### braces - retired from the allowlist (upstream advisory-data change)

`braces` GHSA-vfj7 is no longer reported by `pnpm audit` at all. **No fix was published** -
`braces@3.0.3` is still the newest version and still what `micromatch@4.0.8` declares - so this
was an upstream change to the advisory's data, not a release we waited for. The allowlist entry
and the accept section were removed on 2026-11-09 when the script printed its retirement
notice. If `pnpm audit` ever starts reporting GHSA-vfj7 again, the old analysis (build-time
only, needs a pathological repo-authored glob) still applies and the entry comes back.

### Next.js - 6 advisories, fixed by upgrade

Six advisories landed against `next@16.3.6` after the triage above. All six are patched in
`16.3.8`, so the fix is a version bump rather than an allowlist entry:

| Advisory | Severity | Issue |
|---|---|---|
| `GHSA-cjq9-62q9-8jv4` | high | SSRF in Image Optimization |
| `GHSA-mcj8-r9mp-w47p` | moderate | SSG/ISR cache poisoning, cross-user content substitution and DoS |
| `GHSA-4jqv-mc3x-m676` | moderate | SSG/ISR cache poisoning in self-hosted apps |
| `GHSA-3w37-wq28-93x7` | moderate | Pending `use cache` fill can leak Draft Mode content |
| `GHSA-f87g-xv8r-7p7x` | moderate | Metadata image route disclosure via `dynamicParams` bypass |
| `GHSA-39w2-rjm5-chcv` | low | Dev server MCP endpoint disclosure |

These are not allowlist material. Two are production-reachable (SSRF in image optimization,
ISR cache poisoning), so suppressing them would have been the wrong call regardless of the
gate's rules. `apps/web` and `packages/ui` both move to `16.3.8` (and to `16.4.1` in the
2026-11-09 wave above), and `sync-templates` propagates the bump to scaffolded projects so new
apps do not ship the vulnerable pin.

### nodemailer - 13 advisories, zero real exposure

This was the largest single block in the audit and the least dangerous of them.

`packages/core` declares `nodemailer: ^10.1.4` (floor raised from `^10.0.10` on 2026-11-09 for
five new advisories, resolving 10.4.0) and resolves past every advisory's patched range. The
vulnerable copy was a **second, older** 7.0.13 pulled in as an
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
  nodemailer `^10.1.4` directly.

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

On 2026-11-09 GHSA-6pq8-jhm2-2vcw raised the floor again and the override was widened to match
(`<=6.16.0` -> `>=6.16.1`), still inside stripe's range:

```yaml
qs@>=6.14.2 <=6.16.0: ">=6.16.1"
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

**Six remain as of 2026-11-09.** None has a fix we can take without breaking something, and all
six sit in `apps/mobile`'s Expo dependency graph (the workspace's own dependencies are all
patched - see [The 2026-11-09 wave](#the-2026-11-09-wave---36-advisories-fixed-in-tree)).

**Four of the six are build-toolchain only** - `glob`, `minimatch`, `deepmerge` and the Expo
side of `zod` never enter a JS bundle in a form an attacker reaches. `decode-uri-component` is
the exception: it is **reachable at app runtime**, as corrected on 2026-10-12 after review. The
original triage's blanket claim that none of them is shipped application code was wrong for that
one, so exposure is now stated per entry.

The pre-2026-11-09 accepts for `node-forge` and `braces` are gone: both were retired by the
script's notice and are documented under [Fixed](#fixed) above.

**Re-verified 2026-10-12** (for the original entries). Each entry below carries its own date
and evidence.

### decode-uri-component 0.2.2 - moderate + high (two advisories)

Accepted: `GHSA-vcc3-ghjq-m6fr` (moderate) and `GHSA-qr28-fpjm-wq7f` (high). Both were reported
against the same resolved copy after 2026-11-09; the analysis below covers both - the second
advisory is the same defect one line further along the changelog, and its fix (`>=0.5.1`) is the
same ESM-only release, so every argument against taking `0.5.0` applies to `0.5.1` unchanged.

- **Path:** `apps/mobile -> expo-router@57.0.23 -> query-string@7.1.3 -> decode-uri-component`
  (re-checked with `pnpm why decode-uri-component`; the same chain repeats through
  `@expo/cli@57.0.27 -> @expo/router-server@57.0.11`)
- **Fix available but rejected:** the advisory needs `>=0.5.0`. `query-string@7.1.3` declares
  `^0.2.2` and is CommonJS; it does `const decodeComponent = require('decode-uri-component')`
  and then calls it as a function. `decode-uri-component@0.5.0` is ESM-only, so under
  `require(esm)` it returns a namespace object. Verified directly: the direct call fails with
  `TypeError: decodeComponent is not a function`, while `decodeComponent.default(...)` works.
  Forcing the upgrade would break `query-string` at runtime.
- **Re-verified 2026-10-12** in a scratch install (nothing added to this repo): forcing
  `decode-uri-component@0.5.0` into `query-string@7.1.3`'s tree reproduces the failure on Node
  v24.21.0 for `parse`, `parseUrl`, `pick` and `exclude`. `decode-uri-component@0.5.0` is
  `"type": "module"` with an `exports` map and no CommonJS entry point, so `require()` returns
  `{ __esModule, default }`. The message name differs from the original note (`m` is the
  minified binding) but the cause is the same.
- **Why query-string cannot move:** 7.1.3 is the newest 7.x, and `expo-router@57.0.25` - the
  newest stable release, on both the `latest` and `sdk-57` dist-tags - still pins
  `query-string: ^7.1.3`. `query-string@8.x` also still depends on `decode-uri-component@^0.4.1`,
  which is inside the vulnerable `<=0.4.2` range, so even a 7 -> 8 move changes nothing.
  Expo SDK 58 exists only on the `next` and `canary` dist-tags (`expo@58.0.7`,
  `expo-router@58.0.17`), so there is no stable release to move to.
- **The other override is worse, not better:** `query-string@9.5.1` is the first version that
  depends on `decode-uri-component@^0.5.0`, but it is also ESM-only, so
  `require("query-string")` returns `{ __esModule, default }` and `qs.parse(...)` throws
  `TypeError: qs.parse is not a function`. Verified in a scratch install on the same Node. It is
  additionally a two-major jump over what `expo-router` declares, on a path that runs inside the
  app bundle - the guardrails rule that out.
- **Exposure: runtime, not dev/build only.** Corrected 2026-10-12 after review: this was
  previously recorded as build-time only, which is wrong. `query-string` **is** in the shipped
  mobile bundle, and it parses incoming URL query strings while the app runs. The chain, read off
  `node_modules`:

  ```
  apps/mobile package.json "main": "expo-router/entry"
    -> expo-router/entry.js -> entry-classic -> build/qualified-entry
    -> build/ExpoRoot.js:135        <NavigationContainer linking={store.linking} ... />
    -> build/fork/NavigationContainer.js:12   require("./useLinking")   (native: useLinking.native)
    -> build/fork/useLinking.native.js:46     Linking.addEventListener('url', ...)
       build/fork/useLinking.native.js:115    getStateFromPath(path, config)
    -> build/react-navigation/core/getStateFromPath.js:41   require("query-string")
       build/react-navigation/core/getStateFromPath.js:499  queryString.parse(query)
    -> query-string@7.1.3/index.js:3          require('decode-uri-component')
       query-string@7.1.3/index.js:233        decodeComponent(value)   <- 0.2.2
  ```

  So a deep-link query string reaches the vulnerable decoder on device. `apps/mobile/app.json`
  declares `"scheme": "quark"`, so `quark://...?q=...` links are handled by the app.
  (Establishment is module-graph analysis, not an emitted bundle: `expo export` cannot currently
  produce one - see "Known unrelated breakage" below.)
- **What that changes about the risk:** the DoS is now reachable from attacker-influenced input -
  a malformed query string in a link a user opens - instead of only from something authored
  locally. It is still a **moderate** advisory, and it is still a denial of service in URL query
  parsing, not code execution or disclosure. But it is not zero-exposure, and the residual risk
  should be stated rather than waved away.
- **Why it is still accepted rather than fixed:** taking the fix converts that into a guaranteed
  crash. `decode-uri-component@0.5.0` is ESM-only, so under `query-string@7.1.3`'s
  `require('decode-uri-component')` `decodeComponent` is a namespace object and every call throws
  `TypeError: decodeComponent is not a function` - i.e. the app breaks on *every* deep link that
  carries a query parameter, including well-formed ones. Overriding `query-string@9.5.1` instead
  breaks it at module scope. A crash on all links is strictly worse than a crash on a
  pathological one, so the fix is not an improvement and is not taken. Node v24.21.0, reproduced.
- **Unblocked by (now higher priority):** `query-string` bumping to a version that drops the
  dependency, or a patched `decode-uri-component` release that keeps a CommonJS entry point. Both
  are tracked as the follow-up that would actually retire this advisory.

### zod 3.25.76 in Expo's graph - high

- **Advisory:** GHSA-mrhx-c7xc-m3w5 - memory exhaustion while validating oversized constrained
  collections.
- **Path:** `apps/mobile -> expo / expo-router / expo-* -> zod@3.25.76` (every Expo package
  declares `zod: ^3`). The workspace's own copies are fixed: floor `^4.6.6`, resolving 4.6.7
  (`apps/web`, `packages/config`, `packages/core`, `packages/db`, templates).
- **Fix available but rejected:** the advisory's patched range is `>=4.6.6`, so the only way to
  clear it is `zod@<4.6.6: ">=4.6.6"` - forcing Expo's runtime internals onto zod 4, a major
  with breaking API changes (schema construction, error types, `.strict()`/`.passthrough()`
  semantics) that expo and expo-router call directly at app runtime. CI would not catch the
  difference: the Mobile job runs lint + tsc against `apps/mobile`'s own source, not Expo's
  validation paths.
- **Exposure:** runtime (Expo's own validation of route/deep-link input), but the advisory is a
  memory-exhaustion DoS reached only with an oversized constrained value.
- **Recommendation:** accept until Expo declares zod 4 on a stable release; re-check then and
  the override becomes the obvious move.

### glob 13.0.6 - moderate

- **Advisory:** GHSA-3g3m-2fjr-6pw4 - AbortSignal cancellation bypass allows post-timeout
  filesystem traversal.
- **Path:** `@expo/cli`, `@expo/config-plugins`, `@expo/config`, `@expo/metro-config`,
  `@expo/fingerprint`, `expo-updates` (all declare `glob: ^13`).
- **Fix available but rejected:** the fix needs `>=14.0.2`, a major outside every dependent's
  range. CI's Mobile job runs only lint + tsc, so forcing glob 14 into fingerprinting, prebuild
  and metro config would ship an untested break in native build tooling for a correctness/DoS
  issue on a path that never runs in production.
- **Exposure: build-time only.** Globs here match repo-authored paths; no attacker-controlled
  pattern reaches them.
- **Recommendation:** accept until Expo widens the range; re-check then.

### minimatch 10.2.6 - moderate

- **Advisory:** GHSA-g3hv-75wg-m249 - DoS via globparts amplification.
- **Path:** `@expo/fingerprint` and `glob@13` (declare `minimatch: ^10`).
- **Fix available but rejected:** needs `>=11.0.1`, a major outside the dependents' range, with
  the same CI blind spot as `glob` above. This is the same class as the retired `braces`
  advisory: build-time pattern matching over developer-authored paths, needing a pathological
  pattern authored in the repo rather than attacker input.
- **Recommendation:** accept until Expo widens the range; re-check then.

### deepmerge 4.3.1 - low

- **Advisory:** GHSA-gcqx-w48m-w2h4 - `mergeObject()` allows prototype poisoning of its return
  value.
- **Patched versions: `<0.0.0`.** No fixed release exists; 4.3.1 is the newest published, so
  there is nothing to override to.
- **Path:** `apps/mobile -> expo -> @expo/config -> deepmerge` (config merging during prebuild
  and CLI startup).
- **Exposure: build-time only.** The inputs are config objects built from repo files
  (`app.json`, `expo-plugin` output), not attacker-controlled keys.
- **Recommendation:** accept; re-check if a 4.4+ appears.

## Re-checked 2026-10-12 - no fix became reachable

Checked against the GitHub advisory database (`gh api repos/usequark/quark/dependabot/alerts`)
and the npm registry, per advisory:

| Advisory | Newest published | GitHub `first_patched_version` | Reachable by | Verdict |
|---|---|---|---|---|
| `node-forge` GHSA-86w9-cpqp-85rv | 1.4.0 | `null` | nothing - no patched release exists | still accept, build-only |
| `braces` GHSA-vfj7-8cjw-p6xm | 3.0.3 | `null` | nothing - no patched release exists | still accept, build-only |
| `decode-uri-component` GHSA-vcc3-ghjq-m6fr | 0.5.0 | `0.5.0` | only by overriding past `query-string@7.1.3` | still accept, **runtime-reachable** |

A lockfile refresh was considered for all three and cannot move any of them:

- `node-forge` and `braces` have no newer release at all, so any resolution lands on the same
  affected version.
- `query-string@7.1.3` declares `decode-uri-component: ^0.2.2`, and a caret range on a `0.x`
  version pins the minor (`>=0.2.2 <0.3.0`). 0.2.2 is already the newest version that range can
  resolve, so a refresh keeps 0.2.2 and only a deliberate override could change it.

The only edits that could take the decode-uri-component fix - overriding
`decode-uri-component` to `0.5.0`, or `query-string` to `9.x` - both break the CommonJS caller,
and the second is a two-major jump on a path that runs inside the app bundle. Both were tested
rather than assumed. No `package.json` or lockfile change was made.

**One correction made during this pass, after review:** the original triage recorded all three as
build-toolchain only. That holds for `node-forge` and `braces`, but `decode-uri-component` is
runtime-reachable — expo-router's linking stack calls `queryString.parse` on incoming deep-link
query strings, so a malformed one reaches the vulnerable decoder on device. The verdict is
unchanged (the fix would break every deep link, not just the pathological one), but the exposure is
recorded as it is rather than as the old blanket claim described it.

## Re-checking after an upgrade

Run `pnpm audit:check`. If any of the six accepted advisories disappears, it moved upstream and
this document should be updated - the check prints a notice naming the entry to retire (that is
how `node-forge` GHSA-86w9 and `braces` GHSA-vfj7 were removed on 2026-11-09). Note that
`pnpm audit` reads the lockfile, so a stale `.pnpm` directory can make a resolved tree look
unfixed - `rm -rf node_modules && pnpm install` if a count looks stale.

A lockfile refresh on its own will not retire the accepts: their fixes are blocked by declared
ranges (`zod`, `glob`, `minimatch`), by an ESM-only release a CommonJS caller cannot use
(`decode-uri-component`), or by there being no release at all (`deepmerge`). The signal to
watch for is an upstream release or an Expo range change, not a lockfile resolution. The
history of the last such pass is under
[Re-checked 2026-10-12](#re-checked-2026-10-12---no-fix-became-reachable).

## Enforced in CI

`pnpm audit:check` runs `scripts/check-audit.mjs`, which CI invokes on every push and pull
request. The accepted advisory IDs (six as of 2026-11-09) are an allowlist in that script, so
it passes today and turns red when a new one appears.

A bare `pnpm audit` step could not do this: it exits non-zero for *any* advisory, so it would
fail forever on the accepted set and get ignored. The allowlist is keyed on the GitHub advisory
ID because that is stable across advisory metadata edits in a way the npm advisory ID is not -
the `braces` retirement is exactly the kind of upstream data change that key survives.

The script treats "the audit did not run" as a failure rather than as a clean tree. `pnpm audit`
reports its own failures as JSON on stdout with exit 1 - for example
`{"error":{"code":"ERR_PNPM_AUDIT_NO_LOCKFILE"}}` - which has no `advisories` key at all. Reading
that as zero advisories turns a missing lockfile or an unreachable registry into a green build
that verified nothing, which is the one failure mode a security gate must not have.

It fails closed on unrecognised report shapes for the same reason: an `advisories` key that is
present but null, or any non-object, is rejected rather than defaulted to an empty set. So is an
advisory with no usable `github_advisory_id` - a legacy or CVE-only record with a null ID can
never match the allowlist, so dropping it would report a clean tree while a vulnerability is
present. An advisory the check cannot identify is one it cannot clear.
`scripts/check-audit.test.mjs` (17 tests) covers both directions, including these cases.

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

- No `auditConfig.ignoreCves` or `audit.level` change. The six accepted advisories are
  reported honestly rather than silenced. Those pnpm settings mute the audit database, which
  would hide the accepted set *and* anything new; the allowlist in
  `scripts/check-audit.mjs` is code, reviewable in a diff, instead.
- No Dependabot alert dismissal.
- No application-level mitigation code for any advisory.
- No Socket integration. Socket reports a broad set of behavioural heuristics (shell access,
  network access, eval, unmaintained, copyleft) that are largely expected for a CLI and build
  toolchain. Its CVE counts matched `pnpm audit`, and `pnpm audit` is already enforced in CI.