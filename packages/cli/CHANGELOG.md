# @usequark/quark-create-app

## 1.25.12

### Patch Changes

- [#268](https://github.com/usequark/quark/pull/268) [`6a0d9e3`](https://github.com/usequark/quark/commit/6a0d9e37395ba5920f982558ad72347feabe7fcf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(proxy): stop spending the strict auth rate-limit budget on a dead route
  
  `STRICT_AUTH_RATE_LIMIT_ROUTES` listed `POST /api/auth/signin/credentials`, but
  no client ever posts there: the next-auth client sends credentials sign-ins to
  `/api/auth/callback/credentials` (it picks `callback/<provider>` for credentials
  providers), and `@auth/core`'s POST `signin` action for a credentials provider
  only redirects to the sign-in page. The dead entry wasted one of the bucket's 5
  requests per 15 minutes on a no-op and left the set claiming protection the
  app did not need. It now covers exactly the two paths that verify a credential:
  `callback/credentials` and the hand-written `register` route.

## 1.25.11

### Patch Changes

- [#266](https://github.com/usequark/quark/pull/266) [`530edaf`](https://github.com/usequark/quark/commit/530edaf984f984ce4cac5f47533275411de63b5a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop `/api/health` from probing queues, and correct the memory figure from [#259](https://github.com/usequark/quark/issues/259)
  
  **The probe was always empty, and it cost ~14 MB on the hottest path in the app.**
  
  `/api/health` passed `queues: () => checkQueues(getRegisteredQueues)` into
  `runHealthChecks`. `getRegisteredQueues()` returns a Map of queues registered
  *in this process*, and the web service registers none — the worker owns every
  long-lived queue. So `checkQueues` returned `null` and no `checks.queues` key was
  ever emitted from the web process.
  
  Reaching `getRegisteredQueues` at all meant importing `@usequark/quark-core/queue`,
  which statically imports BullMQ. That route is polled by the Railway platform
  healthcheck and by `<HealthIndicator />` on every visitor page load, making it the
  worst possible place to load a queue library for a result that is always empty.
  
  Queue depth is not lost: the worker already publishes it as the `job_queue_depth`
  gauge (`updateQueueDepths()` in `apps/worker/src/index.js`, every 30s).
  
  **This also corrects a false claim in [#259](https://github.com/usequark/quark/issues/259)'s changelog.** That entry — now shipped
  in `@usequark/quark-core@2.6.3` — states the health response "no longer carries a
  `checks.queues` key". It did. A rebase against upstream's `/health` refactor
  restored the import without the rebase being checked against what the subpath
  exports, so the claim was untrue as published. This change makes it true.
  
  The same entry's **"roughly 60 MB of RSS" is also wrong.** Measured on Node 24,
  three runs each, after an explicit GC:
  
  | Import | RSS | bullmq modules | msgpackr |
  |---|---|---|---|
  | `@usequark/quark-core` (barrel) | 76.9–77.2 MB | 150 | 4 |
  | narrow subpaths | 62.3–62.5 MB | 0 | 0 |
  
  The real saving is **~14 MB**, not 60 MB — roughly $1.70/month per web service at
  Railway's $10/GB-month, not ~$7.20. The mechanism is real and was verified: the
  150 BullMQ modules do go to zero. Only the headline number was never measured.
  
  **Behaviour change:** `GET /api/health` no longer emits a `checks.queues` key. In
  a scaffolded app it never emitted one, because the web process registers no
  queues. A project that registers queues *in the web process* would lose the key —
  use the worker's `job_queue_depth` instead.
  
  Verified: `quark-web` 314/314, full suite 9/9, lint clean,
  `sync-templates:check` in sync, `pnpm --filter @usequark/quark-web build` succeeds,
  and a static reachability scan confirms neither the barrel nor `/queue` is
  reachable from `/api/health`.

## 1.25.10

### Patch Changes

- [#263](https://github.com/usequark/quark/pull/263) [`ac0ad19`](https://github.com/usequark/quark/commit/ac0ad19f494c6c6fa0d0d73a161735773450efd5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(auth): require a verified address on the Google web sign-in too
  
  [#260](https://github.com/usequark/quark/issues/260) closed the mobile route: `POST /api/auth/google` now refuses a token whose
  `email_verified` claim is not confirmed. The web sign-in was left with the same
  gap and is closed here.
  
  `GoogleProvider` was configured with a client id and a secret and nothing else,
  so NextAuth used its default profile mapper — one that reads `profile.email`
  unconditionally and hands it to the Prisma adapter, which creates the user on
  first sight. An address Google has not confirmed therefore reached the database
  with the confirmation that is supposed to establish ownership of it skipped.
  Google does issue tokens for unconfirmed addresses.
  
  The provider now maps the profile itself and throws for anything not
  confirmed. Auth.js catches whatever the mapper throws and treats a missing user
  as "something went wrong or the user cancelled", so the outcome is a redirect
  back to the sign-in page: no session, and no user row written.
  
  The refusal is thrown rather than returned on purpose. Auth.js has no "null
  means refuse" contract — `getUserAndAccount` reads `profile.email` straight off
  whatever the mapper hands back, so a null denial would work only by tripping a
  `TypeError` that lands in the same catch and is logged as an
  `OAuthProfileParseError`, indistinguishable from a malformed provider response.
  Throwing puts the actual reason in the one place an operator can read it.
  
  `email_verified` is the same string-or-boolean claim the mobile route reads, so
  the rule moved into `apps/web/src/lib/email-verified.js` and both paths now call
  one helper. Two copies of that rule would be free to drift, and a drift would
  read to an operator as "sign-in works on the web but not in the app".
  
  Behaviour change: a Google account whose address is not verified can no longer
  sign in through the web button. Google sets `email_verified` on every account it
  will authenticate, so the accounts this turns away are the ones nobody can prove
  they own.
  
  Seven tests. Dropping the `profile` option from the provider fails all seven —
  the assertion that the mapper exists, and the helper that resolves it outside
  its own try/catch, are what stop the suite passing against the vulnerable
  default. Swapping the explicit comparison for a truthiness check fails four.
  
  The suite reads the mapper through `provider.options.profile` because that is
  where `GoogleProvider()` puts user-defined options; Auth.js hoists them onto the
  provider when it parses the list at runtime, which is how every documented
  `profile()` customization reaches the callback handler.

## 1.25.9

### Patch Changes

- [#260](https://github.com/usequark/quark/pull/260) [`d51904d`](https://github.com/usequark/quark/commit/d51904d2e6821919da7708b95058504950219603) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(auth): refuse Google sign-in for an unverified address
  
  `POST /api/auth/google` checked that the token was genuine and bound to this
  app, then read the address off it and either signed that account in or created
  it on the spot. It never looked at `email_verified`.
  
  Google issues ID tokens for unconfirmed addresses — some Workspace accounts,
  and accounts created recently enough that the confirmation round-trip has not
  finished. Nothing about such a token proves the person presenting it can read
  the inbox, and since this route creates the account on first sight, the
  confirmation that is supposed to establish ownership of the address was simply
  skipped. A working address on an account someone else controls is an account to
  receive password resets and notifications for, not proof of identity.
  
  The check is deliberately strict: only an explicit confirmation passes. A
  missing claim, a null, a number, or anything that is not `true` is refused —
  a wrong refusal costs one unlucky sign-in, and a wrong acceptance hands an
  unconfirmed address a session. Google's `tokeninfo` endpoint reports the claim
  as the string `"true"`, not a boolean, so a naive truthiness check would have
  done the opposite of the obvious thing: accepted `"false"` while rejecting every
  real sign-in. The helper accepts both the string and boolean spellings.
  
  Ordering: the check runs after the missing-email `400`, which describes the
  shape of a token rather than reporting a refusal, and before any database work.
  An unverified address never reaches `findByEmail`, so it cannot become an
  account-creation or existence oracle.
  
  Refusals return the same generic `401` as every other verification failure.
  A distinct message would tell a caller that their token was structurally valid
  and name the one check left to work around.
  
  Behaviour change: a Google account whose address is not verified can no longer
  sign in through this endpoint. Verify the address in the Google account, or
  sign in with a provider that returns a confirmed one.
  
  Seven tests, each mutation-checked — replacing the helper's explicit comparison
  with a truthiness check fails 4, returning `true` from it fails 5, and removing
  the check fails 5.

- [#259](https://github.com/usequark/quark/pull/259) [`41b3c11`](https://github.com/usequark/quark/commit/41b3c11ce1e20a7c1a9cacc2b54ca9767bd52172) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - perf(core): keep BullMQ out of the web process via narrow subpath imports
  
  The `@usequark/quark-core` barrel re-exports 27 modules, one of which
  statically imports BullMQ. A route that imported the barrel for a single
  symbol — `validateBody`, `createLogger` — pulled BullMQ, ioredis and msgpackr
  into that route's module graph. Measured on Node 24, importing the barrel
  costs roughly 60 MB of RSS before doing any work, almost all of it BullMQ. A
  web service holding that for its lifetime is a direct Railway memory charge
  at $10/GB-month.
  
  This does not change the barrel. It stops the framework's own routes from
  needing it.
  
  **Three additive subpaths** cover the symbols that previously had no narrow
  entry point, so callers no longer have to reach for the barrel to get them:
  
  - `./redis` — `resolveRedisConnection`, `pingRedis`, `getRedisUrl`
  - `./multipart` — `parseMultipart`
  - `./email-templates` — `welcomeEmail`, `passwordResetEmail`
  
  The existing exports map is unchanged and the barrel still re-exports
  everything it always did, including `./queue/index.js`. Removing that
  re-export would break any consumer importing `createQueue` from the barrel,
  so it stays.
  
  **Every internal call site in `apps/web` and `apps/worker` now imports a
  narrow subpath** — 29 files, plus the 3 in `packages/config` and
  `packages/db`. No file in either app imports the barrel at module scope
  anymore.
  
  Two routes needed more than a mechanical rewrite because importing the queue
  module there would have moved the cost onto the worst possible path:
  
  `/api/health` previously called `getRegisteredQueues` to report queue depths.
  This endpoint is polled by the Railway healthcheck and by
  `<HealthIndicator />` on every page view, so importing the queue module here
  loads BullMQ on the hottest path in the app — the exact regression this
  change exists to prevent. Queue introspection now belongs to the worker, and
  `/api/metrics` is the place to read queue depth. The health response no
  longer carries a `checks.queues` key.
  
  `/api/auth/register` previously imported `createQueue` at module scope, which
  both loaded BullMQ at startup and permanently attached a Redis connection to
  the web process on the first successful registration. The queue module is
  now a dynamic import inside the handler, and the `Queue` is closed once the
  job is added, so the connection is released rather than held for the
  lifetime of the process. The job is already persisted in Redis by then, so
  closing is safe. A failed enqueue still does not block account creation.
  
  `health/route.test.js` mocked the barrel; its mocks are now scoped to the
  three subpaths the route actually imports, and it no longer stubs
  `getRegisteredQueues`.
  
  The `@usequark/quark-create-app` bump ships the equivalent template changes,
  so newly scaffolded projects start with the narrow imports rather than
  inheriting the barrel.
  
  Also fixes a Biome 2.x config error that made `pnpm lint` exit non-zero on
  every run: `linter.rules.preset` is not a known key, the group is
  `linter.rules.recommended`. This was pre-existing and unrelated; it is
  included because the lint gate could not pass without it.

## 1.25.8

### Patch Changes

- [#255](https://github.com/usequark/quark/pull/255) [`e0aa5f9`](https://github.com/usequark/quark/commit/e0aa5f91d581968567b7c6fcf39624ab6f3d8165) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(auth): bind OAuth sign-in tokens to this deployment
  
  `POST /api/auth/google` and `POST /api/auth/apple` verified that a token was
  genuine and then minted a first-party session for whatever address it carried.
  Neither checked the token's audience, so an id token Google or Apple issued to a
  *different* app for the victim's address was accepted here.
  
  The exploit needs no stolen credential. The attacker gets the victim to sign in
  to any app registered with the same provider — one they control — and posts the
  resulting token to this route. The signature verifies, `findByEmail` finds the
  victim, and the attacker is logged in as them. Google guarantees the `email`
  claim belongs to the token's subject, which is precisely what makes it usable.
  
  Three changes, all fail-closed:
  
  - **`aud` is checked against the configured client id.** Google via
    `tokeninfo.aud`; Apple by passing `audience` to `jwtVerify`, which enforces it
    during verification.
  - **Both routes return `503` when no client id is configured.** These routes are
    public — nothing about them requires your frontend to call them, or anyone to
    have enabled social sign-in — so "nobody configured it" is not a reason to
    keep serving. Serving unconfigured meant accepting tokens with no audience check
    at all, strictly weaker than the configured case that at least returns 401.
  - **Apple's `nonce` is no longer discarded.** The client sends a raw nonce and
    hands Apple its SHA-256 digest; the route re-hashes what it received and
    compares in constant time. The claim is required rather than optional, because
    a token with no `nonce` proves nothing about which sign-in attempt it came
    from, and treating "client sent no nonce" as "skip the check" would leave
    Apple's replay defence off for any caller who simply omits the field.
  
  Every rejection returns one generic `401`. A distinct message for an audience
  mismatch or a nonce mismatch tells an attacker their forged token was
  structurally valid and names the check left to work around.
  
  The two `KNOWN GAP` tests that recorded this are inverted into assertions that
  the token is refused and that no user row and no token are created. Each new
  guard is mutation-tested: removing the audience comparison fails 4 Google and 3
  Apple tests, removing the 503 gate fails 2 each, removing the nonce checks fails
  4, and removing the blank-trim guard in the config accessor fails 2.
  
  `GET /api/auth/apple` now requires `nonce` in the request body. The bundled
  mobile client already sends one.
  
  Apple's `APPLE_CLIENT_ID` accepts a comma-separated list of audiences. Native
  iOS identity tokens carry the bundle identifier as `aud`; web-flow tokens carry
  the Services ID. A single-value audience would reject one of the two, so both
  are accepted when configured as a list. `getAppleClientIds()` in
  `@usequark/quark-config/oauth` returns the parsed list and `isAudienceValid`
  accepts either a single id or an array.
  
  Behaviour change: an app with no OAuth client id configured can no longer use
  these endpoints. That is the point — but it is a change, so set the client id
  before deploying if you rely on mobile sign-in.

- [#257](https://github.com/usequark/quark/pull/257) [`d3183ff`](https://github.com/usequark/quark/commit/d3183ff107ce49e13e939aa53987d429e89d7d3e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Declare the Postgres and Redis databases in the generated `.railway/railway.ts`, so a second `quark deploy railway` no longer plans to delete them.
  
  `generateIacFile()` emitted `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` references but never declared the resources they point at. Railway treats an omitted resource in a whole-project file as absent, and absent means delete — so the second apply of every scaffolded project planned to destroy the databases the first one created.
  
  The scaffold template `packages/cli/templates/base-project/.railway/railway.ts` carried the same omission, and is updated to match. A test now fails if a generated file references a database without declaring it.

- [#256](https://github.com/usequark/quark/pull/256) [`abc9114`](https://github.com/usequark/quark/commit/abc911475581ebf324f911584f0f6133ecdbeba2) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - refactor(cli): overhaul base-project README template to match calibre-surveying style
  
  The scaffolded README was 164 lines of dense onboarding content — scaffold
  metadata, PWA docs, "First Files to Edit", "Feature Guides", internal CLI
  commands, a 40-line Railway deploy section, and an AI-Assisted Development
  prompt. It read like a manual, not a front door.
  
  The new template is ~55 lines and mirrors the calibre-surveying README:
  a branding block (logo, tagline, tech badges), Quick Start, Services table,
  Development commands, Database table, Project Structure with inline comments,
  Tech Stack bullets, and a Deployment pointer. Scaffold metadata moves to an
  invisible HTML comment. Railway deploy instructions move to a new
  DEPLOYMENT.md. Onboarding docs stay in docs/ where they belong.
  
  The branding block is seeded from data the CLI already collects: the logo
  points at apps/web/public/quark.svg (the Quark mark the scaffold already
  ships as a stand-in icon) and the tagline is the project brief captured by
  --prompt or the interactive prompt. Both are placeholders on purpose — the
  doctor now reports them:
  
  - check S6 ("README branding block is still the Quark default") warns while
    the logo still points at quark.svg or the tagline is still the default
    "<name> application", and says what to swap in
  - check E7 ("README still contains references to Quark") no longer fires on
    the invisible scaffold comment or the stand-in logo src, so it only reports
    Quark references the author actually wrote into the README

## 1.25.7

### Patch Changes

- [#253](https://github.com/usequark/quark/pull/253) [`327960a`](https://github.com/usequark/quark/commit/327960a39fcd1471719700eafc524e3c3dfd46ef) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat(config): declare the OAuth client ids so the auth routes can bind tokens to this app
  
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `GITHUB_ID` and
  `GITHUB_SECRET` were read directly from `process.env` but declared nowhere: not
  in the env schema, not in `ENV_DESCRIPTIONS`, not in any `.env.example`. An
  operator setting them got no validation, no documentation of their effect, and
  no signal when half a provider was configured.
  
  They are now optional schema fields, so an app that never enables social
  sign-in is unaffected. New helpers on `@usequark/quark-config/oauth` —
  `getGoogleClientId`, `getAppleClientId`, `isGoogleAuthEnabled`,
  `isAppleAuthEnabled`, `isAudienceValid` — give the auth routes one place to ask
  whether a provider is configured and to compare a token's audience against the
  configured client id.
  
  Two behaviours are pinned here, ahead of the routes using them:
  
  - A blank or whitespace-only client id reads as *not configured*. Counting it as
    configured would compare every token against the empty string and reject all
    of them, presenting as "sign-in is broken" rather than "sign-in is off".
  - `isAudienceValid` returns false when the expected client id is missing. A
    caller that forgets to gate on enablement fails closed rather than open.
  
  Startup now warns when a GitHub or Google client id is set without its secret
  (or the reverse). `auth.js` registers a NextAuth provider only when both halves
  are present, so a half-configured provider hides the sign-in button with nothing
  to explain why.
  
  `.env.example` and the Railway example no longer describe OAuth as "Not Yet
  Implemented" — the routes have shipped and are reachable. They now name the
  client ids the `/api/auth/google` and `/api/auth/apple` routes bind tokens to,
  and `TROUBLESHOOTING.md` covers the two failure modes this makes diagnosable: a
  half-configured provider hiding the sign-in button, and a mobile client id that
  does not match the server's.
  
  The routes themselves are unchanged, and the docs say so rather than describing
  behaviour that does not exist yet. Applying the audience check — and gating each
  route on its client id so an unconfigured deployment refuses rather than serving
  a weakened check — is the next change.

## 1.25.6

### Patch Changes

- [#250](https://github.com/usequark/quark/pull/250) [`da7b6a5`](https://github.com/usequark/quark/commit/da7b6a5fc898e40f0040bd4324a8c4ea7e192bd8) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Scaffolded projects get a working pre-auth CSRF handshake.
  
  The template's register page posted to `/api/auth/register` with no `x-csrf-token`, and its `/api/csrf` route required a session — so a visitor could not obtain a token, and no client anywhere in the template ever called the endpoint. The four other `withCsrfProtection` routes (`/api/users`, `/api/users/me`, `/api/files`, `/api/files/[id]`) were unreachable from the browser for the same reason.
  
  `GET /api/csrf` now serves callers with no session and marks every response `no-store` + `Vary: Cookie`, and `RegisterPageClient` sends the token via `getCsrfToken()` from `@usequark/quark-core/csrf-client`. Builds from this template against `@usequark/quark-core` 2.6.2 or later.

- [#252](https://github.com/usequark/quark/pull/252) [`286fb7e`](https://github.com/usequark/quark/commit/286fb7ee654a0c9e0aa0ffca4dd1a4538831e816) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - The scaffolded register page now proves its CSRF token, and retries once if the server has rotated the cookie.
  
  `RegisterPageClient` retried nothing on a `401`, so a client holding a token the server no longer recognises — after a sign-out, or anything else that clears cookies — was left with a dead button and no explanation. It now clears the cached token, fetches a fresh one, and retries the write once; a second failure surfaces normally.
  
  The scaffolded integration tests send a real token instead of relying on the exemption this repo no longer ships.
  
  Requires `@usequark/quark-core` 2.6.2 or later.

## 1.25.5

### Patch Changes

- [#239](https://github.com/usequark/quark/pull/239) [`3269068`](https://github.com/usequark/quark/commit/3269068620be9b6845ac5792c0dd33fcf889752b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Warn when a project will never sweep its orphaned files.
  
  `File.uploadedBy` is `onDelete: SetNull`, so deleting a user leaves their file rows
  and blobs behind rather than removing them. `CLEANUP_ORPHANED_FILES` is the only
  thing that sweeps those, and it runs in the worker — which is scaffolded only
  alongside the optional `jobs` feature.
  
  Declining `jobs` therefore left orphaned rows and blobs accumulating with nothing to
  surface them: the rows are valid, and no route reads `uploadedById = null`. The
  realistic path there was declining the prompt or passing `--packages ui`, since
  `--no-prompts` defaults to including `jobs`.
  
  Two warnings now, both non-blocking:
  
  - **At scaffold time**, when `jobs` is not selected, naming the consequence and the
    command to add it later.
  - **At deploy time**, `discoverQuarkDeployProject` returns a `warnings` array
    alongside `diagnostics`, and `quark deploy inspect` prints it. A warning does not
    fail the deploy: `jobs` is optional and a project with no uploads has no orphan
    problem.
  
  `warnings` is deliberately a separate field from `diagnostics`, because
  `resolveQuarkDeployProject` throws on any diagnostic — folding this in would make
  worker-less projects undeployable.

- [#240](https://github.com/usequark/quark/pull/240) [`2585390`](https://github.com/usequark/quark/commit/25853908071eba908a65786217d14d4de6578f39) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add `pnpm audit:check` and enforce it in CI.
  
  `pnpm audit` reports 3 advisories, all in `apps/mobile`'s Expo build toolchain and all
  documented as accepted in `docs/dependency-audit.md` — `node-forge` and `braces`, which
  have no patched release at all, and `decode-uri-component`, whose fix is ESM-only and
  would break the CommonJS `query-string` that calls it.
  
  A bare `pnpm audit` step in CI exits non-zero for any advisory, so it would fail forever
  on those three and get ignored. `scripts/check-audit.mjs` instead allowlists the three
  GitHub advisory IDs, passes today, and turns red when a fourth appears. When an accepted
  one disappears — an upstream fix landed — it prints a notice naming the entry to retire
  rather than failing, so the drift is visible.
  
  The check treats "the audit did not run" as a failure, not a clean tree. `pnpm audit`
  reports its own errors as JSON on stdout with exit 1, e.g.
  `{"error":{"code":"ERR_PNPM_AUDIT_NO_LOCKFILE"}}`, which has no `advisories` key; reading
  that as zero advisories turns a missing lockfile or unreachable registry into a green
  build that verified nothing.
  
  It fails closed on unrecognised report shapes for the same reason: an `advisories` key
  that is present but null, or any non-object, is rejected rather than defaulted to an
  empty set. So is an advisory with no usable `github_advisory_id` — a legacy or CVE-only
  record can never match the allowlist, so dropping it would report a clean tree while a
  vulnerability is present. An advisory the check cannot identify is one it cannot clear.
  17 tests cover both directions.
  
  The allowlist stays in code rather than `auditConfig.ignoreCves` or `audit.level`, which
  mute the audit database and would hide the accepted three as well as anything new.

- [#246](https://github.com/usequark/quark/pull/246) [`bb7d1c5`](https://github.com/usequark/quark/commit/bb7d1c56e8ec46a342796140f5cff07a0b3dcc5b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(deps): bump `next` to 16.3.8 — four published advisories
  
  Next.js 16.3.6 is affected by four advisories, all patched in 16.3.8:
  
  | Severity | Advisory | Issue |
  |---|---|---|
  | HIGH | GHSA-cjq9-62q9-8jv4 | SSRF in Image Optimization |
  | HIGH | (second HIGH) | — |
  | MODERATE | GHSA-f87g-xv8r-7p7x | Information disclosure in App Router metadata image routes via `dynamicParams` bypass |
  | MODERATE | GHSA-mcj8-r9mp-w47p | Cache poisoning in SSG/ISR rendering |
  
  `scripts/check-audit.mjs` fails the `Lint & Standards` check on these, which
  blocks every PR — not just dependency bumps.
  
  Two pins needed changing, not one:
  
  - `apps/web` — `16.3.6` → `16.3.8`
  - `packages/ui` — `16.3.6` → `16.3.8`
  
  `packages/ui` carries `next` as a regular dependency (it renders through the
  App Router), so bumping only `apps/web` left 16.3.6 in the tree and the audit
  still failed. Scaffolded projects inherit both pins via `sync-templates`.
  
  After the bump: `No new advisories. 3 accepted (0 now resolved).`

- [#247](https://github.com/usequark/quark/pull/247) [`e720122`](https://github.com/usequark/quark/commit/e720122e3535260ced5bb9a7ad84bec69390a806) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Author the release commit as the token's own user, so the release PR is mergeable.
  
  The release PR showed `Bobnoddle` as its author while its head commit was
  authored by `github-actions[bot]`, and GitHub held every `pull_request` run on
  it at `action_required` with no check result — so the PR was permanently
  `BLOCKED` and the release could not be merged. Eight changesets were pending
  against it.
  
  Two separate identities were wrong, and GitHub gates on both:
  
  **The pusher.** GitHub decides whether a `pull_request` run may start from the
  credential that pushed the head commit, not from the PR's author.
  `changesets/action` opens the PR with its `github-token` input
  (`RELEASE_PR_TOKEN`) but pushes the branch with the git CLI — and
  `actions/checkout` persists an `http.https://github.com/.extraheader` carrying
  the job's `GITHUB_TOKEN` into the local git config, which outranks whatever the
  release step authenticates with. So the push went out as `github-actions[bot]`.
  `persist-credentials: false` fixes that.
  
  **The commit author.** The action runs with `setupGitUser` enabled, whose
  `setupUser()` writes `user.name`/`user.email` = `github-actions[bot]` into the
  repo config. Local config outranks the environment for those two, so exporting
  `GIT_AUTHOR_*` alone does not help — the commit came out bot-authored even with
  all four set. The repo config is now written too, which is what actually takes
  effect.
  
  The existing `Verify the release PR token` guard could not see either one: it
  inspects the secret rather than the resulting commit or the pushing credential,
  so it logged `Release PRs will be opened by Bobnoddle` in the very run that
  pushed a bot-authored commit. That is a green run reproducing the exact bug the
  step exists to prevent. A new probe fails the run if the author or committer
  identity is still unresolvable, so a bot-authored release commit is now a red
  run rather than a green one followed by an unmergeable PR.
  
  No change to what gets published, or when. This only affects who the commit is
  attributed to.

- [#244](https://github.com/usequark/quark/pull/244) [`ae0e3be`](https://github.com/usequark/quark/commit/ae0e3bef349d8c2ec8691009ab854322a0cdf759) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Correct the `--packages` help text. It advertised `mobile` as a create-time option, but the
  create command rejects `mobile` outright and tells you to run `quark add mobile` after
  scaffolding. The help now lists the actual create-time set (`ui,jobs,pwa`), states that
  `db`, `config`, and `ui` are always scaffolded, and points mobile at the post-create path.
  
  Docs only otherwise. The embedded skill index shipped a table advertising five skills that
  were removed from the template (`admin-dashboard`, `bookings`, `crm`, `cms`, `ai`), so an
  agent reading it would try to load files that were not there. It now lists the eleven skills
  that actually ship.

- [#235](https://github.com/usequark/quark/pull/235) [`57ebd06`](https://github.com/usequark/quark/commit/57ebd0615c66fcc6ede8b1414648f1031578da39) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refuse admin self-deletion on `DELETE /api/users/[id]`, and return `401` rather
  than an unhandled rejection when a CSRF check fails.
  
  **Admin self-deletion is refused.** The route resolved its target purely from the
  path segment and only checked the caller's role, so an admin could delete their
  own row — and if they were the last admin, leave the deployment with nobody able
  to administer it. The guard compares the session identity against the path
  segment and returns `409`. It runs before the existence check, so a refused
  request never reads from the database and cannot be used to probe which ids are
  real.
  
  This is a per-request guard, not a check on the remaining admin count. Two
  concurrent deletes of the two last admins can still both pass it; enforcing that
  invariant needs a transaction around the count and the delete.
  
  **CSRF failures now return `401`.** `withCsrfProtection` calls
  `requireCsrfToken` in its own wrapper, outside the route handler's `try`/`catch`,
  so `handleError` never saw the rejection and the client got an unhandled
  rejection instead of a status code. Fixed in `@usequark/quark-core`; see that
  package's changeset.

- [#245](https://github.com/usequark/quark/pull/245) [`14ae3c3`](https://github.com/usequark/quark/commit/14ae3c36805ffcd91d45e1dbc5b5661f60088628) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Normalise CHANGELOG links to the current repository URL
  
  153 links across three CHANGELOG files still pointed at
  `github.com/Bobnoddle/quark`, from before the repository moved to the `usequark`
  org. GitHub redirects them correctly, so no link was broken — but the repo is
  public now, and a reader expanding a diff link sees the pre-transfer path.
  
  This rewrites the host only: `github.com/Bobnoddle/quark` becomes
  `github.com/usequark/quark`. Commit SHAs, PR numbers, and the
  `Thanks [@Bobnoddle]` attributions are untouched, because those are the
  historical record and they remain accurate.
  
  Pure substitution — 102 lines, all URL host. No behaviour change and no
  published-file content change beyond the link target.

- [#244](https://github.com/usequark/quark/pull/244) [`ae0e3be`](https://github.com/usequark/quark/commit/ae0e3bef349d8c2ec8691009ab854322a0cdf759) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Upgrade Next.js from `16.3.6` to `16.3.8`, clearing six advisories and failing
  `pnpm audit:check` in CI. Two are production-reachable: SSRF in Image Optimization
  (`GHSA-cjq9-62q9-8jv4`) and SSG/ISR cache poisoning leading to cross-user content
  substitution and persistent DoS (`GHSA-mcj8-r9mp-w47p`). The other four are Draft Mode
  content leakage, metadata image route disclosure, a self-hosted cache poisoning variant,
  and a dev-server MCP disclosure.
  
  The bump is a patch within Next 16, so the scaffolded template changes with it: new
  projects no longer pin the vulnerable version. Both `apps/web` and `packages/ui` move, and
  `sync-templates` propagates to `templates/base-project/apps/web/package.json` and
  `templates/ui/package.json`.
  
  The three deliberately accepted Expo build-toolchain advisories are unaffected. Full
  write-up in `docs/dependency-audit.md`.

- [#234](https://github.com/usequark/quark/pull/234) [`ce912c5`](https://github.com/usequark/quark/commit/ce912c51a9a77e5da997bcc835797a0cbdd71f93) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Triage dependency vulnerabilities: 21 advisories down to 3.
  
  - Remove the auto-installed `nodemailer@7.0.13` optional peer that `next-auth` and
    `@auth/core` pull in, clearing 13 advisories. Nothing uses Auth.js's Nodemailer
    provider, so the peer edge is deleted rather than forced past its declared range.
  - Override `qs` to `>=6.16.0` via `stripe`, inside the range `stripe` itself declares.
  - Override `uuid` to `>=11.1.1`. `xcode@3.0.1` calls only `v4()`, and that call site was
    exercised against a real generated pbxproj to confirm it still returns a valid ID.
  - Refresh `shell-quote` and `source-map-js` in the lockfile; no override needed.
  - `pnpm standards` now fails the build if anything imports
    `next-auth/providers/nodemailer`, since removing that peer edge is what makes it
    unresolvable. It matches static, dynamic and re-export forms, and the message names
    the fix. 20 tests in `scripts/check-standards.test.mjs` cover both the forms it must
    catch and the near-misses it must ignore.
  
  Three advisories remain in the Expo mobile build toolchain and are documented as
  accepted risks in `docs/dependency-audit.md`: `node-forge` and `braces`, which have no
  patched release at all, and `decode-uri-component`, whose fix is ESM-only and would
  break the CommonJS `query-string` that depends on it.
  
  Scaffolded projects inherit these overrides, so they audit clean.

## 1.25.4

### Patch Changes

- [#231](https://github.com/usequark/quark/pull/231) [`2f42482`](https://github.com/usequark/quark/commit/2f42482ce6aca594ec0e522f4c180fbe7f17731f) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(deploy): make `quark deploy railway` generate a Railway IaC file that parses
  
  The generated `.railway/railway.ts` did not compile, so `railway config apply`
  could never have succeeded. It failed on two independent syntax faults, both of
  which reached every project because nothing in this repo ever evaluated the file
  — the Railway CLI does that at apply time, in the user's own account.
  
  **A doubled comma in every service.** The object body was assembled by
  concatenating pre-rendered blocks, each of which carried its own separator:
  
  ```ts
  healthcheckTimeout: 120,,
  preDeploy: "pnpm db:migrate:deploy",,
  ```
  
  `healthcheck` ended with a comma and `env` began with one; `preDeploy` ended
  with a comma and `env` began with one. Both services were affected, on every
  run — not an edge case. The service body is now a list of complete fields joined
  once, which makes the separator unrepresentable.
  
  **Unquoted variable references.** `DATABASE_URL: ${{Postgres.DATABASE_URL}}` is
  not a valid expression — `${{` opens an object literal that never closes.
  Railway's reference syntax only resolves inside a string. The call sites passed
  the bare form because the same expression is correct for
  `railway variable set`, where it is a command-line argument rather than an
  expression. The IaC path now goes through a new exported `iacRef()` helper that
  returns the quoted form; the argument path is unchanged.
  
  Also in this change:
  
  - **Every existing link was invisible, so a second deploy created a duplicate
    project.** `isProjectLinked()` looked for `.railway/*.json` in the project
    directory, which is the Railway CLI 3.x layout. CLI 5.x (verified against
    5.62.1) keeps links in `~/.railway/config.json` under a `projects` map keyed by
    absolute directory, and a linked project directory contains
    `.railway/railway.ts` and nothing else — so the check returned `false` for
    genuinely linked projects. The deploy then fell through to naming a new
    project after the checkout directory and ran `railway init`, creating a
    second project instead of reusing the linked one. `readLinkedProject()` now
    reads both layouts, and `APP_NAME` / `APP_DESCRIPTION` come from the name
    Railway resolved rather than from `basename(cwd)`. That was the `minnetonka`
    in the original report: a project called `quark-site`, deployed from a
    directory called `minnetonka`, advertised itself as `minnetonka` in both the
    generated IaC and the Railway variables.
  - **The stale-link cleanup deleted the IaC file instead of the link.** It
    removed `<cwd>/.railway` wholesale, which on CLI 5.x destroys
    `railway.ts` while leaving the actual stale link in `~/.railway`. It now runs
    `railway unlink`.
  - **The SDK install no longer rewrites `package.json` on every deploy.**
    `installRailwaySdk()` skips the `pnpm add` when `railway` already resolves
    (`hasRailwaySdk()`), and passes `-w` explicitly rather than relying on the
    package manager's default. The failure message no longer tells you to run the
    command that just failed.
  - **Overwriting `.railway/railway.ts` is now visible.** It is a tracked file
    that every scaffold ships a hand-written copy of, and the deploy replaced it
    silently. `generateIacFile()` now reports whether it changed anything and
    returns the previous content, and the deploy prints a line pointing at
    `git diff`. Identical content is not rewritten at all.
  
  **The gap that let all of this ship** is closed in `src/deploy/adapters/iac.test.js`:
  the generated file is now parsed as TypeScript, checked for doubled separators
  and bare references, and diffed against the IaC file shipped in
  `templates/base-project` so the generator and the scaffold cannot drift. The
  existing assertion `content.includes("${{Postgres.DATABASE_URL}}")` passed on
  the broken file and pinned the bug; it now requires the quotes. All of these
  were verified failing against the previous generator.
  
  This repo's own `.railway/railway.ts` also called `preserve()` four times
  without importing it — the exact fault fixed in the scaffold template by [#229](https://github.com/usequark/quark/issues/229),
  which did not reach this copy. Fixed, and covered by the same test.
  
  The link-reading fix is verified against the real CLI 5.62.1 layout and against
  `HEAD`: on a directory carrying a genuine link, the old code reported
  `isProjectLinked() === false` and an empty project record. The `~/.railway`
  config also holds the user's OAuth tokens; only the `projects` map is read, and
  a test asserts the token cannot come back out.

## 1.25.3

### Patch Changes

- [#229](https://github.com/usequark/quark/pull/229) [`d22133a`](https://github.com/usequark/quark/commit/d22133a9284d457f834933b0370cd2d602bdcd5b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(deploy): import `preserve` in the generated Railway IaC file, so `quark deploy railway` stops failing on the first deploy
  
  Every scaffolded project's `.railway/railway.ts` called `preserve()` four times
  without importing it:
  
  ```ts
  import { defineRailway, project, service } from "railway/iac";  // no preserve
  ...
        AUTH_SECRET: preserve(),   // ReferenceError
  ```
  
  The Railway CLI only evaluates that file at `railway config apply`, in the
  user's own account, so nothing in this repo ever evaluated it. Every deploy
  died at the apply step with:
  
  ```
  ReferenceError: preserve is not defined
  ```
  
  Three layers missed it, which is why the fix touches all three:
  
  - `packages/cli/templates/base-project/.railway/railway.ts` — the static file
    shipped in every scaffold, now imports `preserve`.
  - `packages/cli/src/deploy/adapters/iac.js` — `generateIacFile()` regenerates
    this file during deploy and hardcoded the same three-name import. The list is
    now derived from the helpers the generated body actually calls, so a helper
    can never be emitted without being in scope.
  - `packages/cli/src/deploy/adapters/railway.test.js` — the existing test
    asserted `content.includes("preserve()")`, which passes on the broken file
    because the call site is present. It now checks that every helper the body
    calls appears in the import list, and names the `preserve` regression
    explicitly. Verified to fail against the old generator.
  
  Reproduced by evaluating the shipped template against `railway@3.12.0`:
  
  ```
  THREW -> ReferenceError: preserve is not defined
  ```
  
  and passing once `preserve` is added to the import.
  
  No behaviour change on a working deploy — `preserve()` was always intended, and
  Railway kept the existing secret either way. This only makes the file valid so
  the apply step can run.

## 1.25.2

### Patch Changes

- [#228](https://github.com/usequark/quark/pull/228) [`861ff6a`](https://github.com/usequark/quark/commit/861ff6afdad54e43975d30a615013d0f145457a8) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix `pnpm test` silently skipping every test file in a dynamic route directory.
  
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

- [#226](https://github.com/usequark/quark/pull/226) [`8a35466`](https://github.com/usequark/quark/commit/8a3546697a2a9187dff7209a7ccacee4c3845a09) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - `/api/health` now delegates its probing to `@usequark/quark-core/health`.
  
  The route was ~260 lines of orchestration — concurrency, per-probe deadlines,
  error normalisation, credential redaction — that every Quark app had ended up
  reimplementing or hand-rolling. It is now the thin HTTP shell: it wires the
  app's probes into `runHealthChecks()` and renders the report.
  
  The route's existing guarantees are unchanged: every dependency probed
  concurrently under its own deadline, always `200` with the verdict in `status`,
  generic error messages in production, and `Cache-Control: no-store`. Those
  invariants moved into core and are covered by `health.test.js`; the route tests
  now cover the wiring, which is what the route is still responsible for.
  
  `checkStorage()` keeps the sentinel write/delete round-trip rather than a
  `stat`: `stat` only proves a path exists and cannot distinguish a read-only
  mount from a writable one, which is the only failure the probe exists to catch.
  The round-trip also works unchanged for S3/R2, where a filesystem permission
  check means nothing.

- [#225](https://github.com/usequark/quark/pull/225) [`940d9fa`](https://github.com/usequark/quark/commit/940d9fabf12b2025985256790c92d2cd31033a9e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix two documentation lies in the scaffolded project entry points, and pin them
  with tests.
  
  `MAIN.md` and `README.md` hardcoded `http://localhost:3000` as the "start here"
  link, but the CLI resolves a free port with `findAvailablePort(3000)` and writes
  the result to `PORT` in the generated `.env`. Whenever 3000 was already taken the
  docs sent the user to a server that was never started. The port logic itself was
  correct; only the docs disagreed with it. Both files now render the port from a
  new `__QUARK_WEB_PORT__` placeholder, so the link always matches the `.env` that
  was actually generated.
  
  `MAIN.md`'s "Read this first" list pointed at `openapi.yaml`. Nothing in the
  scaffold creates that file — the only one in this repository is `docs/openapi.yaml`
  in the Quark monorepo, which is never shipped. An agent that follows `MAIN.md`
  before anything else is told to read a file that does not exist. Removed.
  
  Neither bug was reachable by a test, which is how both survived: the CLI already
  had a suite that scaffolds a real project and checks the output
  (`scaffold-output.test.js`), but it asserted on placeholders and package scopes,
  never on whether a documented path resolves or a documented port matches `.env`.
  Three assertions added there — the doc templates may not contain a literal
  `localhost:3000`, the scaffolded docs must link to the port in the generated
  `.env`, and every path in MAIN.md's "Read this first" section must exist in the
  scaffold output. The port check is made against the template rather than the
  rendered output on purpose: in a rendered project `localhost:3000` is the correct
  link whenever 3000 happens to be free, so an output-only assertion would be
  environment-dependent and would not have caught the original bug. Verified to
  fail 2 of 12 when both bugs are restored.

## 1.25.1

### Patch Changes

- [#224](https://github.com/usequark/quark/pull/224) [`0fc3c65`](https://github.com/usequark/quark/commit/0fc3c65bae51e1e6777589a6242047df2cdcd5c1) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Make `GET /api/files/[id]` resolve a storage key, and stop promising the bytes
  under a URL never change.
  
  The route looked its path segment up by database id, so every URL produced by
  `getAssetUrl()` — which builds `/api/files/<storage key>` — was a 404. It now
  accepts either form. They are disjoint: a cuid never contains `/`, a generated
  storage key always does, so the id path costs no extra query. The bytes are read
  by the key held in the database, never by whatever arrived in the URL.
  
  `Cache-Control` drops `immutable`. The URL has no version segment and nothing
  in it is content-addressed, so `immutable` (never revalidate for a year) was a
  promise this route cannot keep: a reused identifier would leave every browser
  and CDN on the old bytes indefinitely. Now a bounded `public, max-age=3600`,
  which bounds that window instead.

- [#217](https://github.com/usequark/quark/pull/217) [`26b0c58`](https://github.com/usequark/quark/commit/26b0c58aed7c9b695765fa2affda3b96ce4e5696) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Route `FormField`'s `className` to the control and put error ARIA where a
  screen reader can reach it.
  
  Two independent bugs in `packages/ui/src/form-field.js`, both measured by
  rendering the component under jsdom and dumping the resulting DOM.
  
  `className` was interpolated onto the layout `<div>`, so a caller could not
  style the input. Every sibling component in the package (`Input`, `Textarea`,
  `Select`, `Card`, …) appends `className` to its own root element, which is what
  the prop means everywhere else. Measured before: `className` present on the
  wrapper, absent from the `<input>`. The prop was effectively useless for its
  documented purpose.
  
  `aria-invalid` and `aria-describedby` were placed on a plain wrapper `<div>`
  around caller-supplied children. Those attributes have no effect on a
  non-interactive element, so when `FormField` was given a `<Textarea>` or
  `Select` child the error was never associated with the control a screen reader
  is actually sitting on. Measured before: both attributes on the wrapper
  `<div>`, and `null` on the `<textarea>`. The default `<Input>` path was already
  correct, which is why the existing test passed — it asserted against the wrapper
  rather than the control.
  
  `className` now applies to the control, matching the rest of the package, and a
  new `wrapperClassName` prop styles the layout container for anyone who was
  relying on the old behaviour. The error association is cloned onto a custom
  child so explicit props on that child still win.
  
  Six tests added to `form-field.integration-test.js`, including a guard that no
  `div[aria-invalid]` survives in the DOM. Verified to fail 2 of 10 when the old
  wrapper behaviour is restored.

- [#217](https://github.com/usequark/quark/pull/217) [`26b0c58`](https://github.com/usequark/quark/commit/26b0c58aed7c9b695765fa2affda3b96ce4e5696) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Collect `*.integration-test.js` in the test runner, so component render tests
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

- [#223](https://github.com/usequark/quark/pull/223) [`a819c6d`](https://github.com/usequark/quark/commit/a819c6df626d65f86111705b320c9e1ef65f5e77) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Delete the database row before the stored bytes, so a failed delete cannot
  destroy a file.
  
  `DELETE /api/files/[id]` removed the storage object first and the row second:
  
  ```js
  await storage.delete(record.storageKey);
  await file.delete(record.id);
  ```
  
  `File` has no incoming relations today, so the row delete cannot currently fail
  on a foreign key — but the moment one is added, `prisma.file.delete` throws and
  the bytes are already gone. The row survives pointing at an object that no
  longer exists, and there is no way back: the blob was the only copy. The same
  inverted order was in the worker's orphaned-file cleanup job.
  
  Both now delete the row first and the storage object second, which inverts the
  failure mode. A refused row delete leaves an orphaned blob — junk that the
  existing cleanup job sweeps up — instead of a row pointing at deleted bytes. A
  `P2003` foreign-key error is now reported as a `409`, with the stored bytes
  intact.
  
  The row delete also uses a new `file.deleteIfPresent()` (`deleteMany`, returning
  a count) instead of `file.delete()`, which throws `P2025` when the row is
  already gone. Two overlapping DELETEs both pass the ownership check; the loser
  now gets a `404` and skips the storage delete rather than racing the winner's.
  Previously it would throw `P2025` and surface as a `500`.
  
  A failed storage delete still returns `200`: the row is already gone, so the
  delete succeeded as far as the caller is concerned, and an error the client
  cannot act on would be misleading. The failure is logged rather than swallowed.

- [#217](https://github.com/usequark/quark/pull/217) [`26b0c58`](https://github.com/usequark/quark/commit/26b0c58aed7c9b695765fa2affda3b96ce4e5696) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Mount `ThemeProvider` in the scaffolded root layout and make a missing provider
  fail loudly.
  
  `packages/ui/src/theme.js` exports `ThemeProvider`, `useTheme` and
  `ThemeToggle`, and they are documented as public API in `CLAUDE.md`,
  `docs/ARCHITECTURE.md` and `docs/QUARK_USAGE.md` — but `layout.js` never
  mounted the provider. Nothing raised, so nothing looked wrong.
  
  The failure mode was worse than a missing feature. `ThemeCtx` defaulted to
  `{ theme: "dark", setTheme: () => {} }` and `useTheme()` returned that default
  instead of complaining, so `ThemeToggle` — documented as "Must be rendered
  inside a ThemeProvider" — rendered a real, focusable, correctly-labelled button
  that did nothing on click and always read "Dark Mode" regardless of the actual
  theme. The home page was unaffected because it uses a separate
  `HomeThemeToggle` that drives `localStorage` and dispatches `THEME_CHANGE_EVENT`
  directly; that component is kept, and the provider already listened for the
  event.
  
  Measured on `main` before the change by rendering a bare `ThemeToggle` under
  jsdom and clicking it: `data-theme` stayed `dark`, `localStorage` was never
  written, and not one error was logged. The identical component inside a
  provider flipped `dark` → `light`.
  
  `RootLayout` now wraps `{children}` in `<ThemeProvider>`. The provider emits no
  markup, so it cannot affect layout, and its `useLayoutEffect` runs after
  hydration — the blocking pre-paint script in `<head>` and `suppressHydrationWarning`
  are unchanged. `useTheme()` now throws when no provider is above it, so the same
  mistake surfaces on the first render instead of shipping a dead button.
  
  `packages/ui/src/theme.test.js` is the first test in that package to render the
  theme system at all — every previous theme-adjacent test asserted only the
  export contract, which is why [#6](https://github.com/usequark/quark/issues/6) was invisible. It proves a toggle click moves
  `data-theme`, that the choice persists, that an out-of-tree
  `THEME_CHANGE_EVENT` still syncs React state, and that rendering without a
  provider throws. Verified to fail 2 of 9 when the old no-op default is
  restored. `apps/web/src/app/layout-theme.test.js` pins the wiring and fails when
  the wrapper is removed. Two harness facts are documented in that file: jsdom
  implements no `matchMedia`, and Node has no `localStorage` global.

## 1.25.0

### Minor Changes

- [#219](https://github.com/usequark/quark/pull/219) [`265e7fd`](https://github.com/usequark/quark/commit/265e7fd16dda9a0f2ccbe344db4aba7e8cad4eab) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop the healthcheck from being the thing that kills the service, and stop it
  publishing credentials.
  
  `/api/health` is the platform healthcheck, and it had three independent ways to
  make an orchestrator restart a container that was otherwise fine.
  
  **Probes ran one after another, under a deadline the first two probes could
  exhaust.** Database, Redis, storage, and queues were awaited in sequence. Each of
  the first two carries its own 3s timeout, so a database that was slow to refuse
  plus a Redis that was slow to refuse spent the whole 5s budget before storage was
  even attempted. The outer timer then fired, the route returned **500**, and the
  container restarted — dropping every warm connection and producing a fresh
  connection storm on the dependency that was already struggling. The same held
  when a probe never settled at all. All probes now run concurrently, each under
  its own deadline capped by the overall budget, so the aggregate completes inside
  the budget no matter which dependency is slow.
  
  **The route returned 500 when it ran out of time.** It now always answers **200**
  and reports the verdict in the body's `status` field (`ok` / `degraded`), plus a
  `durationMs` and a `Cache-Control: no-store`. Callers that need a hard verdict
  should read `status`, not the status code. Note this makes a fully degraded
  instance still report healthy to the orchestrator; splitting liveness from
  readiness is the real fix and is deliberately out of scope here.
  
  **The healthcheck was rate limited.** `/api/health` fell into the 100-request
  `api` bucket, so a probe arriving in a full bucket got a **429** — which the
  orchestrator also reads as unhealthy. `/api/health` is now exempt from rate
  limiting entirely: no counter, no `X-RateLimit-*` headers.
  
  Separately, on the credential path: error messages are now redacted in
  production before they leave the route. A probe can report failure by rejecting
  *or* by resolving with `{ status: "error", message }`, and the old
  `pingRedis` took the second route — so normalising only rejections would still
  have published the Redis password. `pingRedis` no longer includes it in the
  first place (see the `@usequark/quark-core` changelog), and the route is the
  second layer.

### Patch Changes

- [#220](https://github.com/usequark/quark/pull/220) [`064f70e`](https://github.com/usequark/quark/commit/064f70e5e580d60a27fc42704a6cac9d0ed587ff) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Initialise scaffolded repositories on `main` instead of inheriting the machine's default branch
  
  `initializeGit` ran a bare `git init`, which inherits `init.defaultBranch` from
  the machine's global git config. That setting is unset almost everywhere, and git
  then falls back to `master` and prints a hint nobody reads — so the same published
  CLI produced a scaffold on `master` in one terminal and on `main` in another. The
  scaffold was not reproducible, and neither were the README's
  `git push -u origin main` instructions.
  
  `git init -b main` pins the branch name, matching the name GitHub defaults a new
  repository to. Falls back to a bare `init` on git older than 2.28, which still
  produces a working repository using git's own default.

- [#219](https://github.com/usequark/quark/pull/219) [`265e7fd`](https://github.com/usequark/quark/commit/265e7fd16dda9a0f2ccbe344db4aba7e8cad4eab) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop writing the Redis password into worker logs.
  
  `waitForRedis` threw `Redis unavailable at ${getRedisUrl()}` when its retries ran
  out, and `startWorker` logged `Redis connected` with the same value as the
  address. `getRedisUrl()` returns `REDIS_URL` verbatim, so a Railway or managed
  Redis URL put the password into the container log and from there into whatever
  aggregates it. Both sites now use `getRedisEndpoint()`, which returns
  `host:port` with the credentials removed.

## 1.24.3

### Patch Changes

- [#216](https://github.com/usequark/quark/pull/216) [`0074d82`](https://github.com/usequark/quark/commit/0074d82ca4e0ac443c9278ea71c72610f93415bb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Treat an empty test suite as a success in scaffolded projects
  
  `scripts/run-tests.mjs` exited 1 when it collected zero `*.test.js` files. A
  freshly scaffolded project ships no test files, so `pnpm test` failed for
  `apps/web` and `apps/worker`, which failed the `pre-push` hook installed by
  `scripts/prepare.js`, which made the very first `git push` impossible without
  `--no-verify`. The same failure would hit CI on any newly scaffolded repo.
  
  The runner now exits 0 and logs `No test files found in: <roots> - nothing to
  run.`, matching the behaviour of stock `node --test`, which already exits 0 when
  it matches no files.

- [#214](https://github.com/usequark/quark/pull/214) [`813ebf0`](https://github.com/usequark/quark/commit/813ebf05afccce7a97cf0b21b1780548f1e11729) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix every theme colour utility in `@task/ui` silently doing nothing in dark mode.
  
  Tailwind v4 removed the bare `[--var]` shorthand that v3 accepted, but a class
  like `text-[--navbar-text-muted]` is still a *valid* utility name in v4. Tailwind
  accepts it, emits a rule, and exits 0 — with the bare token as the declaration
  value:
  
  ```css
  .text-\[--navbar-text-muted\] { color: --navbar-text-muted; }
  ```
  
  `--navbar-text-muted` is not a valid `<color>`, so the browser discards the
  declaration and the element inherits instead. Nothing warns and the rule *is*
  present in the stylesheet, so it cannot be caught by reading the CSS or the build
  output. `body` sets no colour and the inherited default happens to be black,
  which reads as correct in light mode and is unreadable in dark mode.
  
  All 196 occurrences across 20 components are converted to the v4
  `-(--var)` form. Measured with a real Tailwind 4.3.3 build of the actual
  `globals.css` and component sources: 128 declarations emitted the bare token
  before, 0 after. In Chromium, `text-(--navbar-text-muted)` computes to
  `rgb(107,114,128)` in light and `rgb(141,158,192)` in dark, against a fixed
  `rgb(0,0,0)` before.
  
  A uniform substitution is sufficient here. The `--color-*` variables are
  registered via `@theme inline`, but the unregistered ones (`--input-*`,
  `--navbar-*`, `--card-*`) resolve correctly with the same `-(--var)` form —
  Tailwind only needs an explicit `[color:var(--x)]` hint when a variable is used
  as both a colour *and* a font size, and all 48 `text-[--…]` variables in the UI
  package are colour tokens.
  
  `scripts/check-standards.mjs` gains a check that rejects the v3 shorthand, so
  this cannot silently return. It ships inside the CLI and already runs in
  scaffolded projects. The pattern matches the *shape* of the shorthand rather than
  enumerating utility families, so sizing, spacing and typography variants such as
  `w-[--panel-width]` and `leading-[--line-height]` are caught too. The `-`
  immediately before `[` is what distinguishes it from ordinary JavaScript:
  `rows[--i]` and `obj["key--1"]` do not match.

## 1.24.2

### Patch Changes

- [#208](https://github.com/usequark/quark/pull/208) [`3b4f033`](https://github.com/usequark/quark/commit/3b4f0330acdfd2c4128612bdad7d93473118e50e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix a crash on worker startup in every fresh scaffold.
  
  `startWorker()` called `waitForDatabase(config)` when the signature is
  `(healthCheck, config)`, so the config object landed in the `healthCheck` slot
  and every call threw `TypeError: healthCheck is not a function`.
  
  Worse than a crash loop: a `TypeError` is classified as neither a schema nor a
  connection error, so it rethrew on attempt 1 as
  `DATABASE_HEALTH_CHECK_FAILED` and the dev retry config never applied. The
  sibling call to `waitForRedis` was already correct.
  
  The call now passes `undefined` first so the default health check applies, and
  both `waitForDatabase` and `waitForRedis` reject a non-function health check up
  front with a named `AppError` instead of an opaque `TypeError`.
  
  The unit tests missed this because they call `waitForDatabase` directly with a
  function — `startWorker()` was never exercised. Added a test that asserts the
  shape of the real call sites in `startWorker()`, verified to fail when the
  original call is restored.

- [#208](https://github.com/usequark/quark/pull/208) [`3b4f033`](https://github.com/usequark/quark/commit/3b4f0330acdfd2c4128612bdad7d93473118e50e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix `pnpm lint` failing on a freshly scaffolded project.
  
  The scaffolded `biome.json` shipped `"root": false`. With that key Biome looks
  for a root configuration in ancestor directories; a standalone scaffold has
  none, so Biome falls back to its built-in defaults and **applies none of the
  project's own config**. Three consequences, all observed on a real scaffold:
  
  - `files.includes` negations stop excluding anything, so the Prisma client under
    `packages/db/src/generated` gets linted
  - `vcs.useIgnoreFile` is not honoured, so gitignored files are checked
  - `css.parser.tailwindDirectives` is unset, so every Tailwind at-rule in
    `globals.css` reports `Tailwind-specific syntax is disabled` and formatting
    aborts with it
  
  Measured with the scaffold's real per-package lint script: 1 of 7 packages failed
  before the change, 0 of 7 after. At the project root the fix drops the checked
  file count from 157 to 137 on a tree with a planted `src/generated`.
  
  The key is now absent rather than falsy, and the generator deletes it if the
  monorepo config ever grows one, so the template cannot drift back.
  `packages/cli/src/template-config.test.js` asserts no `root` key,
  `tailwindDirectives: true`, `useIgnoreFile: true` and the generated-client
  exclusion.
  
  `apps/web/biome.json` **keeps** `root: false`. It `extends` the project config,
  and with both keys absent Biome rejects the setup as a nested root
  configuration — verified, it exits before checking a single file.

## 1.24.1

### Patch Changes

- [#205](https://github.com/usequark/quark/pull/205) [`f746c10`](https://github.com/usequark/quark/commit/f746c1078ed8ac033bc5c79326e481446f6ca5da) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Move scaffolded workflow actions off deprecated Node.js 20 runtimes
  
  Scaffolded projects shipped workflows pinning `actions/checkout@v4`,
  `actions/setup-node@v4`, and `pnpm/action-setup@v4`, all of which declare
  `runs.using: node20`. GitHub is forcing these onto the Node.js 24 runtime and
  annotating every run with a Node 20 deprecation warning, so every newly
  scaffolded project started its life with deprecation noise in the log.
  
  Bumped to the Node 24 line: `actions/checkout@v6`, `actions/setup-node@v6`,
  `pnpm/action-setup@v5`, `dependabot/fetch-metadata@v3`, and
  `softprops/action-gh-release@v3`.
  
  Four of those are runtime-only moves, confirmed against each action's release
  notes rather than assumed. Two of them cross majors that carry behaviour
  changes, both of which are inert for a scaffolded pnpm project:
  
  - `setup-node` v5 added automatic package-manager caching whenever a
    `packageManager` field is present, and v6 narrowed that automatic caching to
    npm alone. Every generated workflow already sets `cache: pnpm` explicitly and
    the scaffold pins `pnpm@10.12.1`, so generated projects stay outside the
    automatic-cache path and cache exactly as before. A generated workflow that
    ever drops the explicit `cache:` input can opt out with
    `package-manager-cache: false`.
  - `checkout` v6 persists credentials to a separate file rather than writing
    them into `.git/config`. No generated workflow reads authentication back out
    of `.git/config`, so nothing depends on the old location.
  
  `pnpm/action-setup` is pinned to v5 rather than v6 because v5 exists solely to
  move the action to Node 24, whereas v6 only adds pnpm v11 support, which the
  `pnpm@10.12.1` pin does not use. `upload-artifact` moves v4 -> v6 for the same
  reason: v5 was already Node 24-capable but still defaulted to the Node 20
  runtime, so v6 is the first release that actually needs pinning.
  
  Also added a `github-actions` block to the scaffolded `.github/dependabot.yml`.
  Action pins previously had no automation tracking them at all, and because
  GitHub reports a stale runtime only as a log annotation rather than a failing
  check, nothing in CI ever prompted the bump. That is the reason this drift
  accumulated in the first place.

- [#207](https://github.com/usequark/quark/pull/207) [`8cbd810`](https://github.com/usequark/quark/commit/8cbd81072cc08eab0906931f437b35799ca80952) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix scaffolded projects being generated with no `.gitignore`.
  
  **npm strips every `.gitignore` out of published tarballs**, unconditionally and
  with no opt-out. `base-project/.gitignore` is a generated template file, so it
  existed in the repository — where it looked correct in review — but never reached
  anyone installing the CLI from npm. Only a git checkout ever had it.
  
  Projects scaffolded from the published package arrived with `.dockerignore`,
  `.nvmrc`, `.env.example` and `.env.railway.example`, and no `.gitignore`. Since
  the scaffolder runs `git init`, the first `git add .` in a generated project
  staged `node_modules/`, `.next/`, and `.env` — the last populated with real
  credentials by `scripts/prepare.js`.
  
  The content now lives in `src/scaffold-gitignore.js`, which ships because npm
  strips only `.gitignore` and `.npmrc`. The scaffolder writes the file when a
  template copy does not supply one, and `generate-templates.js` writes the
  in-repo copy from the same export, so the file a contributor sees and the file a
  user gets cannot drift.
  
  Verified from a packed tarball — 0 `.gitignore` entries in it, the module
  present — by scaffolding and committing a project with a populated `.env`:
  `.env` and `node_modules/` are ignored, `.env.example` is committed. The
  generator's output is byte-identical to before, so nothing else moved.
  
  Also fixes a latent race in `scaffold-guards.test.js`. git auto-gc prunes loose
  object directories in the background after a commit, and `copyFixture()` walked
  `.git/objects` while that prune was in flight, aborting the process with a C++
  `filesystem_error` rather than an assertion failure. It was already intermittent
  (3/10 runs) and this change made it common (8/10), because fewer files reach
  `git add` now and the object layout shifts. Setting `gc.auto 0` on the fixture
  repo removes the race: 20/20 clean, and the full suite now passes under turbo's
  parallelism, which it previously did not.

## 1.24.0

### Minor Changes

- [#203](https://github.com/usequark/quark/pull/203) [`e9cf902`](https://github.com/usequark/quark/commit/e9cf90288c297629a86ff2880184f9c1bc4c79da) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Standardise on Node 24. Scaffolded projects now develop and deploy on Node 24,
  matching the repository's own `.nvmrc`, which already read 24 while everything
  else said 22.
  
  Generated projects change in three places:
  
  - `.nvmrc` is `24` rather than `22`
  - `apps/web` and worker Dockerfiles move to `node:24-alpine`, re-pinned by digest
  - the generated project's CI matrix moves to `node-version: 24`
  
  The image digest was resolved from the registry rather than copied, and verified
  to cover `linux/amd64`, `linux/arm64` and `linux/s390x` — so Railway deployments
  and local builds on Apple Silicon both resolve. Verified by scaffolding from a
  packed tarball: `.nvmrc`, the Dockerfile digest and the generated CI all agree
  on 24.
  
  **The support floor is unchanged.** `engines` stays `>=22.13.0` in both
  published packages, so nothing breaks for anyone installing on Node 22, and
  `SUPPORT.md`, `docs/adr/001-esm-only.md` and the `engines` reference in
  `docs/TESTING_INFRASTRUCTURE.md` remain accurate as written. The distinction is
  deliberate:
  
  | Declaration | Meaning | Value |
  |---|---|---|
  | `engines` | minimum supported | `>=22.13.0` |
  | `.nvmrc` | version used to develop | `24` |
  | Dockerfile | version shipped | `node:24-alpine` |
  | CI | version tested | `24` |
  
  One consequence worth naming: CI no longer exercises Node 22, so the floor is
  asserted by `engines` but no longer tested. If you want the floor kept honest,
  add a 22 job to the `ci.yml` matrix — say so and it is a two-line follow-up.
  
  The repository's own CI, Dockerfiles, docs and badge move to 24 in the same
  commit so the monorepo and the projects it generates do not drift apart again.

## 1.23.14

### Patch Changes

- [#201](https://github.com/usequark/quark/pull/201) [`26ad839`](https://github.com/usequark/quark/commit/26ad839a885d505d312a6ea35d8e91be0325835a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Pin the Node runtime for scaffolded projects with a `.nvmrc`.
  
  Generated apps now ship a `.nvmrc` containing `22`, matching the
  `node:22-alpine` image their Dockerfiles already pin by digest. Previously a
  scaffolded project declared its Node version nowhere: no `.nvmrc`, no `engines`
  field in any template `package.json`. Local development was therefore free to
  drift from the container that production actually runs.
  
  Deliberately `22` rather than the monorepo's root `.nvmrc`, which reads `24`.
  The root file disagrees with everything else in this repository — CI runs
  `node-version: 22`, every Dockerfile uses `node:22`, and root `engines` is
  `>=22.13.0`. Copying `24` into the template would have made scaffolded local
  development disagree with scaffolded Docker, which is the exact problem this
  change exists to remove.
  
  Verified by scaffolding a project from a packed tarball: `.nvmrc` is present
  with `22`, alongside the existing `.dockerignore` and `.env.railway.example`,
  and matches the Node major in the generated Dockerfiles.

## 1.23.13

### Patch Changes

- [#199](https://github.com/usequark/quark/pull/199) [`c42f6c6`](https://github.com/usequark/quark/commit/c42f6c611c7389c8a755e8ae3d66d2dd370b3bbf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Trim the published CLI tarball and add npm search keywords to both packages.
  
  **Test files are no longer published.** `files` now negates `src/**/*.test.js`,
  which drops 12 files (~72 KB) from the tarball — 237 files down to 225. Nothing
  imported them: the only reference to a test file anywhere in shipped source is a
  comment, and `test-cli.js` that runs them was already excluded because it sits
  outside `files`. Nothing shipped is lost.
  
  Verified by packing both variants and diffing the resulting tarballs: exactly the
  12 test files are removed and nothing else. `deploy.integration.test.js` is
  covered by the same glob, so one pattern is enough. The templates are untouched —
  they contain no test files, so the negation cannot affect a scaffolded project's
  own tests. CI runs the E2E suite from the repository rather than from a packed
  tarball, so it is unaffected.
  
  The packed tarball was installed into a clean directory and smoke-tested: the
  `quark` binary resolves and reports its version.
  
  **`keywords` added.** npm's `scope:` search qualifier returns nothing even for
  packages published eight months ago, so it is not a usable discovery path, and a
  search for the scoped name surfaces unrelated higher-population packages first.
  Keywords are the field npm actually weighs, and neither package declared any:
  
  - `@usequark/quark-core` — quark, nextjs, auth, bullmq, redis, email, storage,
    rate-limiting, logging, zod
  - `@usequark/quark-create-app` — quark, scaffolding, scaffolder, cli, nextjs,
    prisma, bullmq, railway, self-hosted
  
  Neither change affects runtime behaviour or any exported API.

## 1.23.12

### Patch Changes

- [#196](https://github.com/usequark/quark/pull/196) [`19e6a23`](https://github.com/usequark/quark/commit/19e6a2365ecc9828faff379c0d171bce13a88933) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Move the published npm packages from the `@techstream` scope to `@usequark`,
  matching the GitHub organisation the project now lives under.
  
  - `@techstream/quark-core` -> `@usequark/quark-core`
  - `@techstream/quark-create-app` -> `@usequark/quark-create-app`
  
  **No runtime or API change.** `quark-core` keeps all 17 `exports` subpaths
  resolving to byte-identical files, and the CLI keeps the same four `bin` names
  (`quark`, `quark-create-app`, `create-quark-app`, `quark-update`), so only the
  install specifier changes:
  
  ```bash
  npm install @usequark/quark-core
  npx @usequark/quark-create-app
  ```
  
  Scaffolded projects are unaffected in shape — the local-only workspace packages
  (`db`, `jobs`, `ui`, `config`) are still rewritten to your own scope — but the
  published `quark-core` dependency a new project receives is now
  `@usequark/quark-core`.
  
  The `@techstream` packages remain installable and are not being unpublished. If
  you are still on them, switch when convenient:
  
  ```bash
  npm install @usequark/quark-core@latest
  ```

## 1.23.11

### Patch Changes

- [#190](https://github.com/usequark/quark/pull/190) [`7352bb4`](https://github.com/usequark/quark/commit/7352bb444f2e67c7841006664bf59334207a83e6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Switch the project licence from ISC to MIT. MIT carries an explicit patent grant,
  which ISC omits and which some corporate legal teams screen for when evaluating
  a framework dependency.
  
  Scaffolded projects now default to MIT as well, so a generated app inherits the
  same terms as the framework that produced it. Archived reference verticals under
  `docs/archive/` keep their original ISC markers as historical snapshots.

- [#192](https://github.com/usequark/quark/pull/192) [`6c1f436`](https://github.com/usequark/quark/commit/6c1f43682027267161878c0bc22cc62568a857e9) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop pointing scaffolded projects at reference routes that no longer exist.
  
  The `example-page` and `playground` routes were removed from the reference app,
  but the shipped scaffold guidance still told agents to read them. The
  `base-project` `README.md`, `.github/copilot-instructions.md`, and
  `skills/quark-skills/SKILL.md` all referenced those two paths, so every newly
  generated project inherited instructions pointing at files it never received.
  `apps/web/src/app/page.js` is the only remaining public-page reference and is
  what those three templates now cite.
  
  The dead `EXCLUDE_PATTERNS` entries for the removed route directories were also
  dropped from `sync-templates.js`; they no longer matched anything.

- [#190](https://github.com/usequark/quark/pull/190) [`7352bb4`](https://github.com/usequark/quark/commit/7352bb444f2e67c7841006664bf59334207a83e6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Point repository metadata at the `usequark/quark` GitHub org. `homepage`,
  `repository.url`, and `bugs.url` in both published packages, the changesets
  changelog repo, the CLI's user-facing output, and the contributor and
  documentation guides now reference `usequark/quark` instead of the previous
  personal account.
  
  No runtime behaviour changes.

## 1.23.10

### Patch Changes

- [#187](https://github.com/usequark/quark/pull/187) [`e385dfd`](https://github.com/usequark/quark/commit/e385dfd055511c2357bd04e620876142c2d09b50) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Point changesets at the token input it actually reads
  
  [#184](https://github.com/usequark/quark/issues/184) (and its release guard) set `GITHUB_TOKEN` in the step's `env:` and
  declared the release PR would be opened by `RELEASE_PR_TOKEN`. It was not.
  `changesets/action` takes its credential from the **`github-token` input**,
  which defaults to `${{ github.token }}`, and ignores the ambient `GITHUB_TOKEN`
  environment variable entirely. Every API call it makes - the branch push, the
  commit, the PR - used the default.
  
  Observed on the run after the secret was added: the new `Verify the release PR
  token` step passed and logged `Release PRs will be opened by Bobnoddle.`, and
  the release PR was still authored by `github-actions[bot]`, still reported an
  empty check rollup, and was still `BLOCKED`. A correct-looking guard over a
  setting that had no effect - the same shape as the two attempts before it, and
  worth recording so it is not tried a third time.
  
  The token now goes in `with: github-token`, which is the value that decides the
  PR author. The `env:` entry stays so the `changeset publish` child process sees
  the same credential.
  
  The guard added in [#186](https://github.com/usequark/quark/issues/186) is kept, and it is what makes this diagnosable: it names
  the actor in the run log, so the next mismatch between that line and the PR
  author is visible immediately instead of inferred from a stalled check.

- [#184](https://github.com/usequark/quark/pull/184) [`a134533`](https://github.com/usequark/quark/commit/a1345335511b094c24d355ecdd39a7ad8895fb97) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Release PRs now open with a PAT, and a missing token fails the run
  
  Changesets opened the release PR with `GITHUB_TOKEN`. GitHub applies an
  anti-recursion guard to anything triggered by a `GITHUB_TOKEN`-authored PR:
  every workflow on it is held at `action_required` until a human approves it, and
  the run reports **no check result at all**. The required status checks therefore
  could never be satisfied, so the release PR sat unmergeable and every release
  needed a manual click.
  
  The release PR is now opened with a dedicated `RELEASE_PR_TOKEN` — a personal
  access token with the `repo` and `workflow` scopes — because a PAT is an
  ordinary actor whose PRs' checks run normally. It is deliberately separate from
  `NPM_PUBLISH_TOKEN` so the publish credential stays isolated.
  
  **Setup required once:** add `RELEASE_PR_TOKEN` to the repository secrets.
  Until it exists, the Release workflow now fails on a missing token rather than
  reporting green while falling back to `GITHUB_TOKEN`. The step also resolves the
  token's login and refuses `github-actions[bot]`, and logs the actor it will use,
  so the identity behind a release is visible in the run log instead of being
  something to infer afterwards.
  
  Two approaches tried first, recorded so nobody repeats them:
  
  - `pull_request_target` on a separate approver workflow. It runs in the base
    repository's context with a write-scoped token, which sounds exactly right,
    but it is subject to the same guard. Verified: its only two runs were skipped.
  - `workflow_run` on the workflows being approved. This one does fire — 18
    successful runs — so the event itself is not blocked. Whether it can actually
    clear `action_required` was never established, because it was abandoned in
    favour of fixing the cause upstream. Do not read its earlier dismissal as
    "this does not run".

## 1.23.9

### Patch Changes

- [#176](https://github.com/usequark/quark/pull/176) [`9c2c67c`](https://github.com/usequark/quark/commit/9c2c67cc856f9f762fec6b81089d4b0c69bb8306) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - TEMP: retest whether a release PR can be merged without manual re-runs.

- [#171](https://github.com/usequark/quark/pull/171) [`040d380`](https://github.com/usequark/quark/commit/040d380c3fcd8a19b2314560e87ef44633573945) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Guard the dependabot auto-merge gate, not just the group split
  
  The per-severity dependabot groups are already in place, and there is a test
  asserting both configs keep them. That test only covers what a human *sees*.
  It says nothing about what merges unattended, which is decided entirely by
  `.github/workflows/dependabot-auto-merge.yml`.
  
  That gate is correct today — it keys on
  `update-type == 'version-update:semver-patch'`, so minors and majors need a
  human. But nothing asserted it, which leaves the most consequential line in the
  dependency pipeline one careless edit away from auto-merging majors. The
  reference is the bullmq 6 break: `queue.client` was removed in a version
  Dependabot presented as a routine bump, and the two silent regressions that
  followed shipped inside a 35-package PR.
  
  Four new tests, two per config, covering the monorepo and the scaffold
  template. Negative-tested by stripping the `if: steps.meta.outputs.update-type`
  condition from each file in turn: each removal fails exactly one test.

## 1.23.8

### Patch Changes

- [#169](https://github.com/usequark/quark/pull/169) [`037ecb1`](https://github.com/usequark/quark/commit/037ecb172b765b5931dc3578a51af41d868ae8ea) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Validate the session's shape in `requireAuth`, not just its truthiness
  
  `requireAuth()` gated on `if (!session)`. That is not sufficient: a truthy
  object is not the same as an authenticated user, and next-auth 5.0.0-beta.31
  demonstrated the difference on the auth surface. When `@auth/core` answers a
  misconfigured provider with a 500, the client returned the error body as though
  it were a session, so `if (!session)` passed and callers received a "session"
  with `user === undefined`.
  
  beta.32 fixes the source by treating any non-OK response as no session, but
  this guard should not depend on a pre-release library behaving correctly - one
  beta bump is all it takes to fail open again. `requireAuth` now requires a
  `user` with a non-empty string `id` or `sub`, so an error body, an empty
  object, a userless session, and a non-string id all fail closed regardless of
  what the client returns.
  
  `requireRole` already failed closed by accident, via `session.user?.role` not
  matching. That is now incidental rather than load-bearing.
  
  `requireAuth` and `requireRole` take an optional session argument so the guard
  can be tested without constructing a NextAuth instance; when omitted, both read
  from `auth()` exactly as before, so no call site needs to change.
  
  12 new tests cover the error-body case, missing user, identity-less user,
  non-object user, empty-string and non-string ids, and the matching and
  non-matching role paths. Negative-tested: restoring the old truthiness guard
  fails 7 of them, and dropping only the identity check fails 3.

## 1.23.7

### Patch Changes

- [#163](https://github.com/usequark/quark/pull/163) [`c3cf740`](https://github.com/usequark/quark/commit/c3cf740237a020e2716cc486c9f6a62109532515) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Declare the repo's tooling env vars in `turbo.json` instead of silencing them
  
  `noUndeclaredEnvVars` was firing on six environment variables that have no
  business being file-scoped suppressions: `npm_execpath` and
  `npm_lifecycle_event` (injected by the package manager), the three
  `QUARK_SKIP_*` escape hatches used by repo tooling, and `GITHUB_OUTPUT` (set
  by the CI runner). They are now declared in `turbo.json`'s `globalEnv`, which
  is where they actually belong, and the suppressions are gone.
  
  Adding the declaration does not surface new warnings across the repo's ~125
  referenced environment variables — `turbo.json` already declared the rest at
  task level through `env` and `passThroughEnv`, which satisfies the rule the
  same way.
  
  Verified by removing the declaration again: 5 diagnostics return, and 0 with
  it present.

## 1.23.6

### Patch Changes

- [#161](https://github.com/usequark/quark/pull/161) [`5783d7b`](https://github.com/usequark/quark/commit/5783d7b59312571aa16416cd1af8fb99359164d6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop paying for scaffolded projects' CI on changes that cannot break it
  
  Every scaffolded project inherited three CI costs that bought nothing on most
  commits, and one of them quietly removed a safety net.
  
  - Docs-only and `docs/**` changes no longer trigger CI. Every README tweak was
    paying for a full monorepo install, a lint pass and a test run.
  - The Windows job ran on every push and pull request, at the 2x Windows
    billing multiplier, purely to prove `pnpm install` resolves the lockfile -
    which the Linux jobs already cover. It is now `workflow_dispatch` only. The
    check is preserved, just not paid for by default.
  - CI now declares `permissions: contents: read` and a `concurrency` group that
    cancels superseded runs.
  
  `install-windows.yml` is added to the `TEMPLATE_ONLY` list so template sync
  never overwrites it, matching the sibling workflow entries.

- [`6bd092a`](https://github.com/usequark/quark/commit/6bd092aff3a3a073da0c2e4e4a92af47e0957d0d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Clear all 13 Biome lint warnings, each with a stated reason
  
  `noTemplateCurlyInString` (10) was firing on Railway's own `${{Service.VAR}}`
  reference syntax in `.railway/railway.ts` and in the adapter test fixtures that
  exist to exercise that syntax, plus the escaper test for a literal `${}`. The
  rule cannot distinguish those from a missed template interpolation, so both
  files carry a file-scoped `biome-ignore-all` explaining why.
  
  `noUndeclaredEnvVars` (3) was firing on `npm_execpath` and the two
  `QUARK_SKIP_*` escape hatches in `scripts/`. These are repo tooling, not app or
  build inputs, and are suppressed individually.
  
  I also tried allowing them centrally via `allowedEnvVars` in `biome.json`, and
  rejected it: `turbo.json` declares no `globalEnv` at all, so explicitly
  configuring the rule activated it repo-wide and took the count from 13 to 194.
  Fixing that properly means declaring the real env surface in `turbo.json`, which
  is a separate change with its own caching implications.
  
  The rules stay active - verified that a genuinely undeclared variable and a
  missed template literal in an unsuppressed file are both still reported.

## 1.23.5

### Patch Changes

- [`42d588f`](https://github.com/usequark/quark/commit/42d588f5af37186a6b14de9d2ea6fd41622bc370) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop pinning rrweb's version in test-build, and correct the declared Node floor
  
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

- [`a3b3657`](https://github.com/usequark/quark/commit/a3b36572a9119b9883775267801438246266e74b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Retry the lifecycle E2E once before failing the job
  
  A healthy run measures ~40s, but a shared runner with a cold module cache
  measured 123s and tripped the 120s hard limit even though every phase passed
  (`Total: 41.53s` was reported in the same run that later failed). The gate
  decided the job from a single noisy sample, so a transient runner hiccup
  turned CI red and trained people to ignore it.
  
  Thresholds are unchanged - a real regression still fails, it just has to fail
  twice. The first attempt is `continue-on-error` and the retry owns the job
  result, because in GitHub Actions a failed step latches the job to failure
  even when a later step passes; branching on `steps.<id>.outcome` rather than
  `failure()` is what makes the retry meaningful.

## 1.23.4

### Patch Changes

- [`cf9b36e`](https://github.com/usequark/quark/commit/cf9b36e4cb816f418851fea173c58220c995a44e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Split scaffolded projects' dependabot PRs by semver update type
  
  The scaffold template grouped by `dependency-type` alone, so a project created
  by the CLI got one PR bundling patch, minor and major bumps. That is how
  bullmq 6's removal of `queue.client` reached this repo unnoticed inside a
  35-package diff, shipping two silent production regressions.
  
  The template now mirrors the monorepo config: majors get their own PR per
  dependency type, so a breaking change is reviewed on its own. The scaffold's
  `dependabot-auto-merge` workflow already only merges
  `version-update:semver-patch`, so majors continue to require a human.
  
  `dependabot-config.test.js` asserts both configs keep the split, so neither
  can silently regress back to catch-all groups.

## 1.23.3

### Patch Changes

- [#153](https://github.com/usequark/quark/pull/153) [`bdd0470`](https://github.com/usequark/quark/commit/bdd0470b3ce8100992e5a0a2bb08c37b2ec2ebb7) Thanks [@dependabot](https://github.com/apps/dependabot)! - Bump chalk 5→6, commander 14→15, execa 9→10 and @expo/vector-icons 14→15
  
  Split out of the 35-package dependabot PR by the semver-aware group config so
  each major gets reviewed on its own.
  
  All four are ESM-only, which this repo already is, and all require Node ≥22
  (commander ≥22.12.0); the pinned `node:22-alpine` image resolves to 22.23.3.
  
  Verified rather than assumed:
  
  - **chalk** — all 12 `chalk.*` call sites work, including `chalk.red.bold`
    chaining; emits correct ANSI under `FORCE_COLOR` and plain text when piped.
  - **commander** — real `quark --help` and `--version` invocations render.
  - **execa** — `test:build` completes both scenarios (default and pwa) end to
    end: scaffold, install, migrate, and Docker build.
  - **@expo/vector-icons** — the `Ionicons` export chain and the
    `name`/`size`/`color` props are unchanged; v15 loads icon fonts lazily.
    Note the mobile app has no test or typecheck job in CI, so this one is not
    covered by automation.

- [#154](https://github.com/usequark/quark/pull/154) [`307d05d`](https://github.com/usequark/quark/commit/307d05d613966d2fcfb99be7b48b634b84fdd8cd) Thanks [@dependabot](https://github.com/apps/dependabot)! - Bump 16 minor dependencies, including next 16.3.6, react 19.3.0 and rrweb 2.1.6
  
  From dependabot's semver-aware `production-minor` group. Notable:
  
  - **rrweb 2.0.0-alpha.4 → 2.1.6** — the replay recorder's first non-prerelease.
    `record()` keeps the same signature, and every option Quark passes
    (`inlineStylesheet`, `slimDOMOptions` with its 8 `headMeta*`/`comment` keys,
    `recordCanvas`, `recordCrossOriginIframes`, `checkoutEveryNms`) is still
    present in the 2.1.6 runtime bundle.
    `test-build.js` asserted the exact rrweb version, so it is updated to match.
  - **next 16.1.6 → 16.3.6**, **react/react-dom 19.2 → 19.3**, **zod 4.3.6 → 4.6.5**,
    **jose 6.0.11 → 6.2.12**, **pg 8.20 → 8.23**, **@aws-sdk/client-s3 3.1004 → 3.1140**,
    **lucide-react 1.14 → 1.48**, **fs-extra 11.3 → 11.4**, plus type-only and
    mobile packages.
  
  Verified: `test:build` completes both the default and pwa scenarios end to end
  (scaffold, install, migrate, Docker build) with the synced templates;
  `pnpm test` 9/9; lint and template drift clean.

- [`6d5faf2`](https://github.com/usequark/quark/commit/6d5faf247f659a7dedd87425edb481343f885cea) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop the lifecycle E2E from hanging after it passes
  
  `test-e2e-full` launches the scaffolded app with `spawn("pnpm", ["dev"])`,
  which starts a process tree (pnpm -> turbo -> next dev). Cleanup only sent
  `SIGTERM` to the pnpm pid, so the grandchildren survived holding the stdio
  pipes and the parent process never exited. The E2E job sat idle for ~9 minutes
  after printing `Total Duration: 41.53s` and every phase passing, until GitHub
  killed it at `timeout-minutes: 10` and reported the job as *cancelled* rather
  than failed.
  
  The dev server now runs in its own process group (`detached: true`) and
  cleanup signals the whole group, escalating to `SIGKILL` if anything ignores
  `SIGTERM`. Verified the group signal reaches and reaps the tree.

## 1.23.2

### Patch Changes

- [#149](https://github.com/usequark/quark/pull/149) [`0b147d8`](https://github.com/usequark/quark/commit/0b147d8fbf51436c461c56cebad37cc479a816a4) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Bump bullmq to v6 and ioredis to v6
  
  Both majors were split out of dependabot's 35-package PR for individual review.
  
  - **bullmq 5.70.4 -> 6.3.8.** v6 removed the public `queue.client` getter.
    The queue module no longer reaches for it: deduplication uses BullMQ's own
    `deduplication` job option and `checkQueueHealth` uses `waitUntilReady()`.
    Verified 547/547 core tests on 5.70.4 and on 6.3.9.
  - **ioredis 5.10.0 -> 6.0.0.** v6 requires Node >= 20 (this repo requires
    >= 22) and defaults to RESP3. The only commands Quark issues are `PING` and
    a single `EVAL` returning `{count, ttl}`, whose result shape is identical
    under RESP2 and RESP3. Verified against live Redis: the Redis rate limiter
    still returns correct `limited`/`remaining`/`resetTime` values.
  
  Scaffold templates re-synced to match.

## 1.23.1

### Patch Changes

- [#144](https://github.com/usequark/quark/pull/144) [`0e8e1bf`](https://github.com/usequark/quark/commit/0e8e1bf9fd4400a1c85be688739da2d7498284ad) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Detect when a project would be scaffolded inside an existing git repository: warn that the project folder will sit one level below the repository root, and skip git initialisation so a nested repository is never created. Prevents broken pnpm workspaces, turbo and CI workflows caused by a nested project folder.

- [#147](https://github.com/usequark/quark/pull/147) [`fae41f2`](https://github.com/usequark/quark/commit/fae41f280b90f1695d877b825ae79d31c874a75d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Make `createQueue()` close-safe and drop dead queue churn from worker preflight.
  
  - `createQueue(name)` now evicts a queue from the singleton registry when it is closed, so the next `createQueue(name)` returns a fresh, usable instance instead of the poisoned, already-closed one. Queues closed through another path are also detected and replaced, and `closeAllQueues()` iterates a snapshot of the registry while close evicts entries.
  - The worker `preflight()` health check no longer creates and immediately closes a queue per job queue — that code never used the queue and taught an unsafe pattern by example. Handler registration is now counted directly from the handler registry.

- [`a4f89e9`](https://github.com/usequark/quark/commit/a4f89e901a467cf302a0b613b77bb8afb77ceb37) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix 5 env/auth bugs in scaffolded and monorepo apps
  
  - `next.config.js` now falls back to `http://localhost:${PORT}` for `NEXTAUTH_URL`, so the client-side Auth.js base URL matches the dev port instead of hardcoded `localhost:3000`
  - Rate-limit keying uses a new `getClientIp()` helper (`x-forwarded-for` → `x-real-ip` → `unknown`) instead of the removed `NextRequest.ip`, which had collapsed every client into one shared bucket
  - `getAllowedOrigins()` derives dev origins from `process.env.PORT` (with `127.0.0.1` and next-dev host extras) instead of the hard-coded config default, and no longer concatenates ports as strings
  - `validateEnv()` now warns when `APP_URL` is missing in production/staging, where Auth.js and CORS silently fall back to `http://localhost`
  - Scaffolded `.env.example` gets an accurate APP_URL comment, a ≥32-character `NEXTAUTH_SECRET` placeholder (the old one failed startup validation), and a path-free `NEXTAUTH_URL` comment

- [`a79bda4`](https://github.com/usequark/quark/commit/a79bda48fc04a33fb865d7ad8f8239c6147ffd12) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix three scaffold-breaking bugs that made `test:build` (and the nightly Scaffold Container Security job) fail
  
  - **Corrupted initial migration.** `packages/db/prisma/migrations/20260202061128_initial/migration.sql` in the scaffold template began with Prisma's `Loaded Prisma config from prisma.config.js.` log line, captured because Prisma writes it to stdout and the diff was piped with `>`. Postgres rejected the migration with `42601 syntax error at or near "Loaded"`, so **every newly scaffolded project failed its first `db:migrate:deploy`**. `validate-template-migration.js` had been filtering that exact line out of its comparison, so it reported "matches the current schema" while shipping broken SQL — it now hard-fails on any non-SQL preamble, and a new `pnpm --filter @techstream/quark-create-app regen-migration` regenerates the file safely.
  - **Invalid second build scenario.** `test-build.js` scaffolded with `--packages cms`, which the CLI rejects (`Invalid packages: cms`), so the scenario always aborted before testing anything. It now covers `pwa` instead.
  - **PWA manifest conflict.** The `pwa` feature wrote `app/manifest.json` next to the base project's `app/manifest.js`, and Next.js failed the build with `Cannot find module for page: /manifest.webmanifest`. The feature now replaces `manifest.js` with the PWA variant.

- [`bd76583`](https://github.com/usequark/quark/commit/bd765830f782fdcb5778850f3d313b145ce015c5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Strip dev-only native binaries from the worker runtime image
  
  `pnpm deploy --prod` correctly drops `prisma` (a devDependency of `packages/db`),
  but it keeps the peer subtrees pnpm auto-installed *for* that devDependency.
  `prisma` declares `typescript` as an optional peer, and pnpm's `autoInstallPeers`
  installs it anyway - resolving to `typescript@7`, the native Go build, which ships
  a ~100 MB Go `tsc` carrying 10 HIGH CVEs (Go stdlib, `golang.org/x/text`,
  `golang.org/x/net`).
  
  That made the nightly `Container Security` scan fail on the worker image. Nothing
  at runtime needs it: the worker runs compiled JS and reaches Postgres through
  `@prisma/client`. The worker Dockerfile now prunes the auto-installed peer
  subtrees (including the peer-suffixed directories such as
  `valibot@1.4.2_typescript@7.0.2` and nested `.bin/tsc` shims) before the deploy
  output is copied into the runtime stage, and fails the build if a dev-only binary
  reappears. Applied to the monorepo Dockerfile and the scaffold template.

- [`2c93c88`](https://github.com/usequark/quark/commit/2c93c888ccb13b6df4ff5441ef19b536b9cd1709) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync generated templates after the development dependency bump
  
  `sync-templates:check` (Template Drift Check) failed on `main` after the
  dependabot dev-dependency update, because the scaffold templates pin the same
  version ranges. Re-synced `apps/web`, `db`, `ui`, `worker`, and `mobile`
  template manifests so newly scaffolded projects install the current versions.

- [#145](https://github.com/usequark/quark/pull/145) [`3b429ab`](https://github.com/usequark/quark/commit/3b429ab982c8c6696d6852435ca6b3ac7090993d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix git hooks when a Quark project is scaffolded inside an existing git repository (monorepo, Conductor workspace).
  
  - `quark create` no longer creates a nested git repository when the target directory is already inside a git work tree; the enclosing repository tracks the project instead. Set `QUARK_FORCE_GIT_INIT=true` to opt into a separate nested repository.
  - The scaffolded `scripts/prepare.js` now registers nested projects in a shared dispatcher: git runs hooks from the repository root, so each project's commands are executed from its own directory. Multiple nested Quark projects compose instead of overwriting each other, hooks owned by other tools are never overwritten or deleted, and hooks are no-ops in checkouts that do not contain the project.
  - The scaffolded `biome.json` is marked as a non-root configuration so Biome resolves it correctly when the project lives below the repository root.
  - `quark create` now warns that GitHub only runs workflows stored at the repository root when the project is nested, with the remediation steps for enabling CI.
  - The scaffolded `scripts/check-loading.mjs` audit now detects DB-backed pages (it previously matched an un-substituted placeholder and always passed).
  - AI prompts in the scaffolded home page use resolvable package names, and the remaining placeholders are substituted in `MAIN.md`, `.env.railway.example`, `.railway/railway.ts`, and the embedded skills.
  - `quark add` and `quark update` scope their uncommitted-changes guard to the project directory, so dirty sibling files in a parent repository no longer block the commands.
  - The scaffolded `scripts/check-standards.mjs` is synced from the monorepo, so it allows `apps/mobile` TypeScript after `quark add mobile`.

## 1.23.0

### Minor Changes

- [#139](https://github.com/usequark/quark/pull/139) [`540d075`](https://github.com/usequark/quark/commit/540d07554d23ef9318346074dac5c756e4501123) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Migrate deploy CLI from deprecated railway.json Config as Code to Railway Infrastructure as Code (.railway/railway.ts). Adds railway config apply flow, IaC string escaping, deployment status verification, worker DB readiness checks, and public readiness files (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT).

## 1.22.0

### Minor Changes

- [#131](https://github.com/usequark/quark/pull/131) [`10cf35d`](https://github.com/usequark/quark/commit/10cf35d87ea02c22210aee85b41b32df79cc549c) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Remove domain vertical models (CRM, CMS, AI, Booking, Admin) from default scaffold. Domain features are now taught via embedded skills and added on demand, keeping the initial scaffold lean. The Prisma schema trimming logic (`trimPrismaSchema`) and domain-specific template directories (`admin/`, `admin-routes/`, `skills/admin-dashboard/`, `skills/ai/`, `skills/bookings/`, `skills/cms/`, `skills/crm/`) are removed.

### Patch Changes

- [#130](https://github.com/usequark/quark/pull/130) [`b3d07b4`](https://github.com/usequark/quark/commit/b3d07b4133bea19da7693b43fab2cced1cfb85cb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Apply optional chaining refactors and sync templates after Biome 2.5 upgrade

## 1.21.0

### Minor Changes

- [#105](https://github.com/usequark/quark/pull/105) [`8fd6870`](https://github.com/usequark/quark/commit/8fd6870dcf504d7b5090c9ceac9f5cadb4600292) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add optional PWA support as a scaffolded package. When selected via `--packages pwa`, the scaffold generates a Next.js native manifest (`app/manifest.json`), a vanilla service worker (`public/sw.js`) with cache-first static assets and network-first navigation, and a client component for SW registration. Zero external dependencies — no Workbox, no next-pwa, no config file modifications.

### Patch Changes

- [#116](https://github.com/usequark/quark/pull/116) [`7d1f5b7`](https://github.com/usequark/quark/commit/7d1f5b750b1502984a07f16e650afd71ffc7adad) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix incorrect relative import paths for jwt in auth API route templates

- [#119](https://github.com/usequark/quark/pull/119) [`f2ff17b`](https://github.com/usequark/quark/commit/f2ff17be10b869aa117decaa5b3bd80b6748c508) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync mobile template from monorepo source, add OTA runtimeVersion, reject mobile in create flow with guidance to use `quark add mobile`

- [#122](https://github.com/usequark/quark/pull/122) [`f719e69`](https://github.com/usequark/quark/commit/f719e694d0fb6fabb9a7a9537bce34ea88b8cd9e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add template drift prevention: generate-templates.js produces template-only files from source data, sync-watch.js provides real-time auto-sync during development.

## 1.20.1

### Patch Changes

- [#93](https://github.com/usequark/quark/pull/93) [`146915a`](https://github.com/usequark/quark/commit/146915af1082ec0f53f4a8cb803af716d9fb01de) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Auto-generate ADMIN_PASSWORD during scaffolding so `pnpm db:seed` works out of the box on fresh projects.

## 1.20.0

### Minor Changes

- [#87](https://github.com/usequark/quark/pull/87) [`3ed5109`](https://github.com/usequark/quark/commit/3ed510924b99e7efdbf09c197cba445806ee61f6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Bundle all embedded skills with every scaffold and remove the admin dashboard UI. The CLI no longer asks which skills to include — features are now `ui` and `jobs` only, and all skills (including a new `admin-dashboard` skill preserving the CRUD-generation patterns and a `quark-skills` index) ship with every build. The `admin`, `bookings`, `crm`, `cms`, and `ai` feature flags are removed; the dev seed no longer inserts domain-specific demo data; the scaffolded README now includes the `pnpm db:seed` step.

- [#83](https://github.com/usequark/quark/pull/83) [`2af89ff`](https://github.com/usequark/quark/commit/2af89ff6409fe6fa8904c52cccefaeeee4d68cbb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: make embedded skills harness-generic via --harness flag

  The embedded skills are no longer opencode-specific. The CLI now accepts a
  `--harness <opencode|claude|copilot>` flag (default `opencode`) and places the
  skills in the selected harness's auto-load directory (`.opencode/skills/`,
  `.claude/skills/`, or `.github/skills/`). The scaffolded docs and feature rows
  reference the selected harness's skill directory.

- [#85](https://github.com/usequark/quark/pull/85) [`c732267`](https://github.com/usequark/quark/commit/c73226748f76b554a35345b005fbe9a95eaf8a3b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Standardize scaffolded page-title convention: add getPageMetadata() helper to the web SEO lib, switch the title template separator from "·" to "|", and document page-title formulas in the seo skill and project context files.

### Patch Changes

- [#83](https://github.com/usequark/quark/pull/83) [`2af89ff`](https://github.com/usequark/quark/commit/2af89ff6409fe6fa8904c52cccefaeeee4d68cbb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - docs: enrich booking/CMS skills; remove stale vertical + agency docs

  - **Enriched the bookings skill** with the full booking schema (Staff, ServiceType, AvailabilitySlot, Booking), the booking status state machine, and scheduling rules.
  - **Enriched the CMS skill** with the content status lifecycle and media library model.
  - **Removed stale vertical docs** (`BOOKING-SYSTEM-DESIGN.md`, `CMS_OUTLINE.md`) — their domain knowledge is now in the skills.
  - **Removed agency docs** (Techstream pricing/marketing/strategy) and the stale business pitch — they belong in a separate repo.
  - **Removed leftover artifacts** (`technical-task.html`, `PLAN.md`, `PLAN_SUMMARY.md` archived to `reference/`).

- [#88](https://github.com/usequark/quark/pull/88) [`36c9ced`](https://github.com/usequark/quark/commit/36c9ced83208254190e9295db17af7b3077a9fa9) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - docs: replace remaining recipe terminology with skills across docs, CLI comments, and the reference archive README

- [#89](https://github.com/usequark/quark/pull/89) [`e14a134`](https://github.com/usequark/quark/commit/e14a1349843fec1ea24af02efe5a3841646b9aee) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Slim template footprint by excluding test files from scaffolded projects, reducing globals.css to essential design tokens, and trimming the example page. The sync-templates engine now removes locally-excluded files from templates (not just skips syncing them). Stale planning docs archived.

- [#86](https://github.com/usequark/quark/pull/86) [`ec97a10`](https://github.com/usequark/quark/commit/ec97a10d11ad6003daa31585b72952beafc5cccb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync pnpm.overrides from the monorepo root into the scaffold root template so scaffolded projects pick up security overrides (deepmerge-ts, fast-uri) and stop failing Trivy image scans.

## 1.19.1

### Patch Changes

- [#81](https://github.com/usequark/quark/pull/81) [`3834d86`](https://github.com/usequark/quark/commit/3834d869df94d1edc1b5d0a389ca3ae01fbfc002) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(smoke): approve msgpackr-extract build in standalone core check

  pnpm 10+ ignores build scripts not explicitly allowed, so the standalone core
  smoke check (`pnpm add @techstream/quark-core next react react-dom`) failed with
  `ERR_PNPM_IGNORED_BUILDS` for the transitive `msgpackr-extract` dependency. The
  smoke test now passes `--allow-build=msgpackr-extract`.

## 1.19.0

### Minor Changes

- [#79](https://github.com/usequark/quark/pull/79) [`900c3b7`](https://github.com/usequark/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: archive vertical packages and remove vertical code from the monorepo

  - **Archived the vertical packages** (`@techstream/quark-ai`, `@techstream/quark-cms`, `@techstream/quark-crm`, `@techstream/quark-bookings`) to `reference/verticals/packages/`. They are now reference implementations only — the skills point to them.
  - **Removed the vertical code from the monorepo's apps**: the AI/CRM/bookings API routes, the CMS content subsystem, and the worker AI handlers are gone from `apps/web` and `apps/worker`. The monorepo now reflects the minimal scaffold (infrastructure + skills).
  - The scaffold was already clean; this removes the vertical code from the monorepo's own reference apps.

- [#79](https://github.com/usequark/quark/pull/79) [`900c3b7`](https://github.com/usequark/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: make verticals skill-only; embed skills in .opencode/skills; rename recipe → skill

  - **Verticals are now skill-only**: `bookings`, `crm`, `cms`, and `ai` no longer scaffold starter code. Selecting one just recognizes the feature — the embedded skill (always present) teaches the AI to build it. The starter templates are archived to `reference/verticals/`.
  - **Skills embedded for auto-loading**: the skills moved from `skills/` to `.opencode/skills/`, the location opencode auto-loads on context match (no need to point the AI at them).
  - **`recipe` command renamed to `skill`**: `quark skill <feature>` prints an embedded skill.
  - **Skills enriched**: each vertical skill now includes example Prisma models, Zod validation schemas, and test patterns.
  - **Smoke test expanded**: verifies all embedded skills are present and the `skill` command works.

### Patch Changes

- [#79](https://github.com/usequark/quark/pull/79) [`900c3b7`](https://github.com/usequark/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(cli): make ui a required package so minimal scaffolds work

  The base web app (layout, auth, example-page) imports the `ui` package, but a
  minimal scaffold (`--features ""` or `--preset minimal`) did not include it,
  producing a broken scaffold that failed `pnpm doctor:ci`. `ui` is now always
  scaffolded (alongside `db` and `config`), and the web app dependency + `.quark-link.json`
  reflect it so the doctor check passes.

## 1.18.0

### Minor Changes

- [#78](https://github.com/usequark/quark/pull/78) [`234359a`](https://github.com/usequark/quark/commit/234359a2e13bc61a6d107397a0cdfeaafc7880c6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: replace recipes with embedded skills; archive bookings; remove worker AI subsystem

  - **Embedded skills**: replaced the `recipes/` prompt library with a `skills/` directory in the base scaffold. Ships skills for building bookings, CRM, CMS, and AI systems, plus generic skills (add-model, add-endpoint, add-dashboard). Each skill carries the domain context, Quark framework patterns, workflow, end-result shape, and a pointer to the archived reference implementation.
  - **CLI**: the `recipe` command now reads from `skills/`; feature rows/guides reference `skills/`; starter detection checks the API route instead of a recipe file.
  - **Archive bookings**: copied the bookings starter to `reference/verticals/bookings/` as the skill's reference.
  - **Worker AI subsystem removed**: the scaffolded worker no longer ships AI handlers/libs (`context-extraction`, `conversation-compact`, `openrouter`, `summarize`, `truncation`, `tools`) or AI job names — the AI skill teaches how to build them.
  - **Smoke test**: added a minimal-scaffold check that verifies the base scaffold has no demoted-vertical references and ships the embedded skills.

### Patch Changes

- [#76](https://github.com/usequark/quark/pull/76) [`6d037b3`](https://github.com/usequark/quark/commit/6d037b360b0959dd58b62903c01604650913af4f) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(scaffold): remove demoted vertical refs from base template; fix starter paths; add --skip-install to add

  - Removed orphaned references to the demoted vertical packages (`quark-ai`, `quark-cms`, `quark-crm`) from the base scaffold (web/worker `package.json`, `next.config` transpilePackages, `api/ai` + `api/admin/crm` routes, worker `ai.js`/`ai.test.js`). These are now AI skills, not scaffolded packages.
  - Fixed a wrong relative import in all four domain starters (`bookings`, `crm`, `cms`, `ai`): `route.js` used `../../error-handler` (resolved to `app/error-handler`, wrong) instead of `../error-handler`. This broke `pnpm build`.
  - Added `--skip-install` support to the `add` command (previously ignored due to a commander option-shadowing quirk), fixing a flaky `add <feature>` test that timed out during dependency installation.

## 1.17.1

### Patch Changes

- [#74](https://github.com/usequark/quark/pull/74) [`7e4c315`](https://github.com/usequark/quark/commit/7e4c31586e942034ca78ed1a1675b27226a41b81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(scaffold): scaffolded web tests fail out of the box

  A freshly scaffolded project's `pnpm test` failed because the web test script
  (`node --test 'src/**/*.test.js'`) was missing the `--experimental-test-module-mocks`
  flag and ran integration tests that the monorepo excludes. The scaffold now ships
  `scripts/run-tests.mjs` (matching the monorepo runner) and the web test script uses
  `node ../../scripts/run-tests.mjs src --exclude=integration.test.js`. Scaffolded web
  tests pass 56/56 and db tests 52/52.

## 1.17.0

### Minor Changes

- [#71](https://github.com/usequark/quark/pull/71) [`592e0ea`](https://github.com/usequark/quark/commit/592e0ea81a41cc61b49b1834f0985e319a47998a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: scaffold opinionation reduction — API-first, two-view CLI, minified admin + verticals

  Quark becomes API-first with AI-assisted scaffolding:

  - **Two-view CLI**: Human View (product-shaped questions + advanced config) and AI View (`--features`, `--preset`, `--prompt`, `--no-prompts`), plus a `recipe <feature>` command that prints an AI prompt recipe.
  - **Minified admin**: neutral operations shell (`_patterns/` Dashboard/ActionForm/DeployPanel + auto-CRUD fallback), no themed UI imports, no design-language leak into user pages.
  - **Verticals → domain starters**: bookings/crm/cms/ai are now generic endpoint + Prisma model + recipe, scaffolded on demand instead of full packages.
  - **Prompt Library**: `recipes/` core set (add-model, add-endpoint, add-dashboard) + per-feature recipes.
  - **`MAIN.md`**: single agent entry point linking CLAUDE.md, docs/, openapi.yaml, and recipes/.
  - **Package scope reduction**: verticals removed from the default feature list; originals archived to `reference/`.
  - **Fixes**: pass model name to `isListVisible` so per-model hidden fields are honored; fix `MAIN.md` brief placeholder replacement.

### Patch Changes

- [#64](https://github.com/usequark/quark/pull/64) [`66b8cb6`](https://github.com/usequark/quark/commit/66b8cb6819bbf884e02c0cc0c3b55d07b9adb599) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(ci): auto-sync scaffold templates during release to prevent drift

  The release workflow bumps package versions via changesets but never
  re-synced scaffold templates, so every release created template drift
  that blocked unrelated PRs. Templates are now re-synced inside the
  changesets version step, and CHANGELOG.md files are excluded from sync
  since they are release artifacts, not scaffold content.

## 1.16.0

### Minor Changes

- [`c20e541`](https://github.com/usequark/quark/commit/c20e541b3c6690fda859b1c2b997b81ddea280bf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - AI chat system, UI theming engine, SMS service, CRM package, and expanded deployment tooling

  **@techstream/quark-core**

  - New SMS service module with pluggable provider pattern (Twilio built-in, custom provider registry via `registerSmsProvider`)
  - New admin authentication module (`admin-auth.js`) for admin-only route protection
  - New database instrumentation module (`db-instrumentation.js`) with Prometheus metrics (`db-metrics.js`) for query monitoring
  - Queue improvements: `addRepeatableJob` utility using atomic `upsertJobScheduler`, `dedupKey` support for job deduplication with configurable TTL, `removeOnComplete` retention settings
  - Auth: `trustHost` auto-detection for Railway and non-localhost deployments
  - Dependency: nodemailer ^7 → ^9

  **@techstream/quark-create-app**

  - AI chat system: persistent conversations with Claude-style UI (sidebar, message bubbles, streaming indicators), rate limiting, truncation, OpenCode integration, context extraction, permission-based tool routing with full test suites, `throw new Error` → `AppError` in handler
  - UI theming engine: refactor all 20+ components to CSS custom properties, ship 8 design preset themes (brutalist-yellow, red-noir, editorial-coral, soft-wellness, playful-geometric, hyper-saturated, season-04, swiss-minimalist), design-system skill for AI agents
  - CRM package: pipeline tracking with Kanban board, stage columns, client_admin role, config and validation
  - OpenCode deployment templates: server config, agent prompts, skills (accessibility, audience-research, data-analysis, distribution, skill-builder), MCP tools (getTasks, getRelevantContext)
  - Admin UI: new image picker component, sidebar redesign, theme toggle, db-health route, action toast notifications
  - CMS: page builder drag-and-drop improvements, cover image field refactor, cms-public scaffold split for cleaner project structure
  - Auth: PasswordInput with visibility toggle, trustHost detection in scaffolded auth config
  - Umami analytics: Core Web Vitals tracking component, replay recorder component
  - Config: environment validation for AI features, SEO indexing gate hardened (dual `NODE_ENV` + `ALLOW_INDEXING` check), `pnpm.overrides` restore in scaffolded package.json
  - DB: conversation summary model, context model, AI/CRM model migrations, context.js utility with test suite
  - Railway deployment: service validation before deploy, .env.railway.example template, check-loading script, deploy integration test fixes
  - Security: Docker base image bump for CVE-2026-45447, Dockerfile `apk upgrade` stage, nodemailer bump

- [#58](https://github.com/usequark/quark/pull/58) [`1b38b14`](https://github.com/usequark/quark/commit/1b38b140456470b4add3e9c2bde2f7bf3d16891b) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Enhanced media management UI with inline image editing, drag-and-drop page builder improvements, and admin navigation updates

### Patch Changes

- [`1191466`](https://github.com/usequark/quark/commit/119146639f0e53028ebe0a999ecc3008dd23ce67) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix OpenRouter error classification and max-rounds behavior in AI worker

  - **Error classification**: Change remaining `AppError` throws in the streaming code path to `ServiceError("OpenRouter", ...)` for proper external-service error handling (OpenRouter API errors, missing response body, retry exhaustion)
  - **Graceful max-rounds**: Replace `throw new AppError` when the tool-calling loop exceeds 20 rounds with a graceful return that includes `truncated: true` and an assistant hint message, preventing conversation crashes

## 1.15.0

### Minor Changes

- [`9e85dba`](https://github.com/usequark/quark/commit/9e85dba8de2031c91eb129c459110cb105d87fce) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor CMS page builder by removing background animation support in favor of a simpler color-only background model, add HTML sanitization utilities, and replace the `section`/`photo-gallery`/`form` UI components with more focused `container`/`lightbox`/`form-field` alternatives across scaffolded projects.

- [`ad311a8`](https://github.com/usequark/quark/commit/ad311a8967c32b13c5f5d16303f6cc57dc2abd3a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Improve the scaffold DX in `quark-create-app` with clearer onboarding docs, feature-specific scaffold guidance, and a read-only scaffold drift checker with CI-friendly failure mode.

### Patch Changes

- [#54](https://github.com/usequark/quark/pull/54) [`799f9ba`](https://github.com/usequark/quark/commit/799f9ba87f8797d75ce3526ac5379975417cd7c1) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Fix scaffolded route generation and tests for page-content migration behavior, and align build-time slug prerendering with CI environments that do not provide database variables.

## 1.14.0

### Minor Changes

- [#47](https://github.com/usequark/quark/pull/47) [`8be648c`](https://github.com/usequark/quark/commit/8be648cd739c843c905ec2fce541875d8e00b094) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Add the expanded playground and scaffolded UI component updates to `quark-create-app`, harden scaffold parity with runtime standards checks, JavaScript Prisma config support, and worker/auth validation improvements, and ship the related auth-secret fallback and storage path handling fixes in `quark-core`.

## 1.13.4

### Patch Changes

- [`e9411f9`](https://github.com/usequark/quark/commit/e9411f9e1d91ad13cb496e4645d15ba2aff6080d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Split CMS into an explicit scaffold feature instead of bundling it into `admin`, automatically include its current dependencies, and make generated admin routes work cleanly when CMS is not installed.

## 1.13.3

### Patch Changes

- [`3cecbed`](https://github.com/usequark/quark/commit/3cecbeddf1a5764c72688ed0d36c52c95a16eae5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Update scaffolded Railway web deployment guidance to use the correct Next.js standalone server path and preserve static/public assets during the build so production CSS and JS load correctly.

## 1.13.2

### Patch Changes

- [`d49c064`](https://github.com/usequark/quark/commit/d49c0649e6e8759eb1a8abd37887dabe8aaaffdf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Preserve NextRequest semantics when normalizing forwarded development auth requests in scaffolded apps.

- [`274bf3d`](https://github.com/usequark/quark/commit/274bf3dabacc7c517561512c7ddf0e8379d0b09a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Export the documented `auth`, `errors`, and `storage` subpaths from `@techstream/quark-core`, and update scaffolded app manifests so installs set up git hooks without module-type or ignored-build-script warnings.

## 1.13.1

### Patch Changes

- [`5a360a9`](https://github.com/usequark/quark/commit/5a360a979d1a021969680386b4f9adfbc3335308) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix admin scaffolding so Quark create and add also include the CMS package and routes, rewrite generated workspace package names consistently, and keep optional package dependencies installable in generated apps.

## 1.13.0

### Minor Changes

- [`cd830d9`](https://github.com/usequark/quark/commit/cd830d95a3ef66d37b2a0f28d21c910a75d84d1e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add CMS scaffolding, media management flows, security contact metadata, and release-tooling improvements to the Quark CLI templates.

  This release also hardens template sync by excluding local uploads from generated scaffolds.

## 1.11.0

### Minor Changes

- [`b07c53a`](https://github.com/usequark/quark/commit/b07c53af1ef756e0dfb89a03ee011f7a91406438) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - **CLI:** Add `--admin-routes` scaffold flag that generates a full admin panel - CRUD route handlers, field renderer, model table/form components, sidebar, sign-out button, and a dashboard data helper. Admin template now ships with `field-map`, `introspect`, and `query` utilities.

  **CLI:** Update `ui` template with `ErrorBanner`, `RichText`, and updated `ThemeProvider`/theme toggle components. Update `base-project` template with registration, forgot-password, and sign-out auth pages, a floating theme toggle, and revised seed/query helpers. Update `worker` template with default email and file job handlers.

  **Core:** Pre-register queue metrics as named exports from `@techstream/quark-core`: `jobQueueDepth` (gauge), `jobsProcessedTotal` (counter), and `jobDuration` (histogram). Wire `completed` and `failed` worker event handlers to record these metrics automatically. Add `getRegisteredQueues()` and `updateQueueDepths()` helpers so workers can periodically refresh the queue-depth gauge.

## 1.10.0

### Minor Changes

- [`9c7ea5f`](https://github.com/usequark/quark/commit/9c7ea5fbf92037fca1a3193de27e2139d8edba30) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-create-app

  ### UI Component Library - scaffolded projects now include a full component set

  New projects scaffolded with `create-quark-app` now include a complete `ui` package with all core primitives and their tests:

  - `Textarea`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
  - `Checkbox`, `Dialog` (client), `Input`, `Label`, `Select`, `Skeleton`
  - `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
  - `Toast`/`useToast` (client)
  - Theme constants and theme utilities

  ### Worker - email and file job handlers included by default

  The scaffolded `worker` package now ships with ready-to-use job handlers:

  - `handlers/email.js` - handles `sendEmail` jobs via the core email service
  - `handlers/files.js` - handles `processFile` jobs
  - `handlers/index.js` - handler registry
  - Full test coverage for all handlers

  ### AI tool conventions baked into scaffolded projects

  New projects include pre-configured AI tool integration files: `CLAUDE.md`, `.cursor/rules/quark.mdc`, `SKILL.md`, and `copilot-instructions.md` with Quark-specific conventions matching the monorepo standards.

  ***

  ## @techstream/quark-core

  ### Fixes

  - `throttledError` in Redis utilities now logs as **warnings** instead of errors to reduce noise for expected transient failures
  - `waitForRedis` error messages improved for clarity
  - Export ordering in `mail.js` corrected

  ### Refactors

  - Redis error handling streamlined (`redis.js`, `queue/index.js`) - no breaking API changes

## 1.9.0

### Minor Changes

- [`fb110e7`](https://github.com/usequark/quark/commit/fb110e755664ac70ccea7d768a35bd87f72c1492) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-core

  ### Email - pluggable provider system

  The email service has been refactored to use a **Strategy Pattern**. A new `EmailProvider` base class is now exported, along with a `registerEmailProvider()` function so applications can plug in any email provider.

  Built-in providers:

  - `smtp` - Nodemailer (unchanged behaviour)
  - `resend` - Resend API (unchanged behaviour)
  - `zeptomail` - **new** ZeptoMail provider (set `EMAIL_PROVIDER=zeptomail` + `ZEPTOMAIL_TOKEN`)

  Custom providers can be registered at startup and used transparently:

  ```js
  import { EmailProvider, registerEmailProvider } from "@techstream/quark-core";

  class SendGridProvider extends EmailProvider {
    async sendEmail(to, subject, html, text) { … }
  }
  registerEmailProvider("sendgrid", SendGridProvider);
  ```

  ### Storage - pre-signed S3 upload URLs

  `createS3Storage()` now exposes `getSignedUploadUrl(key, options?)` which generates a pre-signed `PUT` URL for direct client-to-S3/R2 uploads (no server proxy required). The local storage adapter exposes the same method and throws a helpful error pointing developers to the correct upload route.

  ```js
  const { url, key, expiresAt } = await storage.getSignedUploadUrl(
    "uploads/photo.jpg",
    {
      expiresIn: 300, // seconds (default: 300)
      contentType: "image/jpeg",
    }
  );
  ```

  ## @techstream/quark-create-app

  ### New utility - `formatProjectDisplayName()`

  A new `formatProjectDisplayName(name)` utility converts a kebab-case project slug to a human-readable title (e.g. `my-cool-app` → `My Cool App`). It is used internally during scaffolding and is exported for use in scripts.

  ### Scaffolded project improvements

  - **`.env.example`** - improved structure and comments: copy-paste instructions at the top, ZeptoMail config block, database pool notes, and `WORKER_CONCURRENCY` variable documented.
  - **`validate-env.js`** - new optional env vars recognised: `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`, `ZEPTOMAIL_BOUNCE_EMAIL`, `APP_DESCRIPTION`, `WORKER_CONCURRENCY`.
  - **Health check** (`/api/health`) - now verifies storage connectivity in addition to database and Redis.
  - **Admin package scaffolding** - `pnpm create quark-app` now includes the admin UI package scaffold.
  - **`nano-staged` / `simple-git-hooks`** - updated linting hooks in the scaffolded template.

## 1.8.0

### Minor Changes

- [`68c1aa1`](https://github.com/usequark/quark/commit/68c1aa12253d66779620b18654a8dc8b6baa8d81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add flexible CLI options and comprehensive test coverage for project scaffolding:

  - **New CLI Flags:**

    - `--no-prompts` - Non-interactive project creation for CI/CD and automation
    - `--features <list>` - Selective package scaffolding (default: `ui,jobs`; valid: `ui`, `jobs`)
    - `--skip-install` - Skip `pnpm install` step during scaffolding for faster iterations
    - `--skip-docker` - Skip Docker volume cleanup for development workflows

  - **New Testing Infrastructure:**

    - Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
    - Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
    - GitHub Actions workflow (`cli-e2e-full.yml`) for automated testing on CLI changes

  - **Improvements:**

    - HTTP health check timeout increased from 10s to 30s for reliability in slow environments
    - Parallel Docker service startup with `--wait` flag support
    - Removed unused internal variables and corrected log output typos

  - **Database Seeding:**

    - Added `prisma/seed.js` with test user and sample data generation
    - Seeding support in both monorepo and scaffolded templates
    - Enhanced CLI to manage database initialization seamlessly

  - **Performance Monitoring:**
    - New `check:perf` script with structured JSON output
    - Threshold-based performance checks for E2E workflows

## [Unreleased]

### Added

- `--no-prompts` flag for non-interactive project creation (CI/CD and automation use)
- `--features <list>` flag to specify optional packages to scaffold (default: `ui,jobs`; valid values: `ui`, `jobs`)
- `--skip-install` flag to skip `pnpm install` step during scaffolding
- `--skip-docker` flag to skip Docker volume cleanup step
- Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
- Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
- GitHub Actions workflow (`cli-e2e-full.yml`) for full lifecycle testing on CLI changes
- Performance monitoring script (`check:perf`) with structured JSON output and threshold checks

### Improved

- HTTP health check timeout increased from 10s to 30s for better reliability in slow environments
- Docker service readiness now runs in parallel with `--wait` flag support, reducing startup time

### Fixed

- Removed unused internal variables (`_TEST_TIMEOUT`, `_currentPhase`, `_isPortInUse`)
- Log output typo corrected (`"porta"` → `"port"`)

## 1.7.0

### Minor Changes

- [`e41d79e`](https://github.com/usequark/quark/commit/e41d79e8a44b2a4d1a0799ca1fecc282b58b4524) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor database connection string logic and enhance environment validation:

  - **feat:** Add Railway deployment configuration for web and worker services with health checks and restart policies
  - **feat:** Enhance environment validation with service-scoped checks (web/worker) and cross-field validation
  - **feat:** Add APP_NAME configuration variable for metadata, emails, and page titles
  - **feat:** Centralize PostgreSQL connection string builder in shared module (`connection.js`)
  - **refactor:** Simplify database client and Prisma config to use shared connection builder
  - **refactor:** Update mail configuration for local development (Mailpit) with cleaner env var handling
  - **test:** Add comprehensive unit tests for PostgreSQL connection string builder covering all scenarios
  - # **chore:** Update Biome schema to 2.4.2

## [Unreleased]

### Added

- `--no-prompts` flag for non-interactive project creation (CI/CD and automation use)
- `--features <list>` flag to specify optional packages to scaffold (default: `ui,jobs`; valid values: `ui`, `jobs`)
- `--skip-install` flag to skip `pnpm install` step during scaffolding
- `--skip-docker` flag to skip Docker volume cleanup step
- Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
- Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
- GitHub Actions CI workflow (`cli-test.yml`) for PR validation
- GitHub Actions nightly workflow (`cli-e2e-full.yml`) for full lifecycle testing

### Improved

- HTTP health check timeout increased from 10s to 30s for better reliability in slow environments
- Docker service readiness now runs in parallel with `--wait` flag support, reducing startup time

### Fixed

- Removed unused internal variables (`_TEST_TIMEOUT`, `_currentPhase`, `_isPortInUse`)
- Log output typo corrected (`"porta"` → `"port"`)

## 1.6.0

### Minor Changes

- [`1fd64b1`](https://github.com/usequark/quark/commit/1fd64b14d9bce32ca8f3246127e1134d0fb1a3aa) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## Production-Readiness Update

  ### @techstream/quark-create-app (minor)

  Enhanced template synchronization and CLI initialization with improved production-readiness features:

  - **New sync-templates.js script**: Robust template synchronization with proper configuration merging and file handling
  - **Updated CLI initialization**: Improved biome configuration handling and template scaffold generation
  - **Template enhancements**:
    - Added GitHub workflows for CI, auto-merge, and release management
    - Improved environment configuration with production SMTP settings
    - Enhanced seed script with user seeding functionality and audit log handling
    - Added validation for email provider and storage options
    - Support for Resend and S3 storage providers in config templates

  ### @techstream/quark-core (patch)

  - **Code refactoring**: Reorganized testing factories module for improved maintainability
  - **No API changes**: All exports and functionality remain stable

  ## Related Issues

  Completes all phases of the production-readiness review plan:

  - Phase 1: Critical Security (10 items) ✅
  - Phase 2: High Severity (6 items) ✅
  - Phase 3: Medium Severity (8 items) ✅
  - Phase 4: Low Severity/Polish (5 items) ✅

  ## Breaking Changes

  **Note**: The core database package has breaking changes (Post model removed), but since `@<app>/db` is scaffolded locally (not published to npm), no version bump is required. The removal is reflected in template updates provided by the updated CLI.

## 1.5.3

### Patch Changes

- [`5069069`](https://github.com/usequark/quark/commit/50690698d4fe1daeaa7f5b49bfb20a97074a2744) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add query builder utilities with search/sort support and introduce request/response logging middleware. Improve CLI docs and add optional build verification test, plus checklist updates.

- [`f142e9c`](https://github.com/usequark/quark/commit/f142e9c57dcac93bfe90bae757ed4126f989a888) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix: complete file upload template, fix migration drift, and clean up orphaned Docker volumes

  - **Docker volume cleanup:** Automatically remove orphaned Docker volumes from previous projects with the same name, preventing `P1000: Authentication failed` errors when re-scaffolding
  - Add missing `File` model to template `schema.prisma` with `User` relation
  - Add `file` query builder to template `queries.js` (create, findById, findByUploader, findOrphaned, delete, etc.)
  - Add `fileUploadSchema` Zod schema to template `schemas.js`
  - Add `File` table, indexes, and foreign key to template initial migration SQL
  - Fix migration SQL drift: add `Account.createdAt`/`updatedAt` columns, `Session.expires` index, `VerificationToken.expires` index, and `Job(status, runAt)` compound index
  - Register `quark-update` as a bin alias so `npx quark-update` works
  - Fix post-scaffolding output to show `npx @techstream/quark-create-app update`

## 1.5.2

### Patch Changes

- [`399e7da`](https://github.com/usequark/quark/commit/399e7da083f26cb1d0196a467e78500129eba4ce) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix: update CLI output and add `quark-update` bin alias

  - Register `quark-update` as a bin alias so `npx quark-update` works
  - Fix post-scaffolding output to show `npx @techstream/quark-create-app update`

## 1.5.1

### Patch Changes

- [`39a99c2`](https://github.com/usequark/quark/commit/39a99c2c2723cc533126531ced2d610ea10353a8) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - chore: normalize package scopes to @techstream in CLI templates

  - Rename `@quark/web` → `@techstream/quark-web` in scaffolded projects
  - Rename `@quark/worker` → `@techstream/quark-worker` in scaffolded projects
  - Normalize template versions to 1.0.0

## 1.5.0

### Minor Changes

- [`590592d`](https://github.com/usequark/quark/commit/590592d87c8dc796fc8025643997b0b0d31cceef) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: add file upload, validation, and storage system

  - Add file validation module with MIME type checking, size limits, and malicious content detection
  - Add multipart form data parsing utilities
  - Add pluggable storage adapters (local filesystem and S3-compatible)
  - Add File model to Prisma schema with associated queries and Zod schemas
  - Add file processing job definition
  - Add file upload/download API routes to the web app
  - Add email and file processing handlers to the worker
  - Update CLI templates to include file upload infrastructure

## 1.4.0

### Minor Changes

- [`17656c6`](https://github.com/usequark/quark/commit/17656c684cd826d8026573b44ae271c197a9110b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add automated release pipeline with Changesets
