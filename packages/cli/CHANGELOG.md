# @usequark/quark-create-app

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

- [#187](https://github.com/Bobnoddle/quark/pull/187) [`e385dfd`](https://github.com/Bobnoddle/quark/commit/e385dfd055511c2357bd04e620876142c2d09b50) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Point changesets at the token input it actually reads
  
  [#184](https://github.com/Bobnoddle/quark/issues/184) (and its release guard) set `GITHUB_TOKEN` in the step's `env:` and
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
  
  The guard added in [#186](https://github.com/Bobnoddle/quark/issues/186) is kept, and it is what makes this diagnosable: it names
  the actor in the run log, so the next mismatch between that line and the PR
  author is visible immediately instead of inferred from a stalled check.

- [#184](https://github.com/Bobnoddle/quark/pull/184) [`a134533`](https://github.com/Bobnoddle/quark/commit/a1345335511b094c24d355ecdd39a7ad8895fb97) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Release PRs now open with a PAT, and a missing token fails the run
  
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

- [#176](https://github.com/Bobnoddle/quark/pull/176) [`9c2c67c`](https://github.com/Bobnoddle/quark/commit/9c2c67cc856f9f762fec6b81089d4b0c69bb8306) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - TEMP: retest whether a release PR can be merged without manual re-runs.

- [#171](https://github.com/Bobnoddle/quark/pull/171) [`040d380`](https://github.com/Bobnoddle/quark/commit/040d380c3fcd8a19b2314560e87ef44633573945) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Guard the dependabot auto-merge gate, not just the group split
  
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

- [#169](https://github.com/Bobnoddle/quark/pull/169) [`037ecb1`](https://github.com/Bobnoddle/quark/commit/037ecb172b765b5931dc3578a51af41d868ae8ea) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Validate the session's shape in `requireAuth`, not just its truthiness
  
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

- [#163](https://github.com/Bobnoddle/quark/pull/163) [`c3cf740`](https://github.com/Bobnoddle/quark/commit/c3cf740237a020e2716cc486c9f6a62109532515) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Declare the repo's tooling env vars in `turbo.json` instead of silencing them
  
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

- [#161](https://github.com/Bobnoddle/quark/pull/161) [`5783d7b`](https://github.com/Bobnoddle/quark/commit/5783d7b59312571aa16416cd1af8fb99359164d6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop paying for scaffolded projects' CI on changes that cannot break it
  
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

- [`6bd092a`](https://github.com/Bobnoddle/quark/commit/6bd092aff3a3a073da0c2e4e4a92af47e0957d0d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Clear all 13 Biome lint warnings, each with a stated reason
  
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

- [`42d588f`](https://github.com/Bobnoddle/quark/commit/42d588f5af37186a6b14de9d2ea6fd41622bc370) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop pinning rrweb's version in test-build, and correct the declared Node floor
  
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

- [`a3b3657`](https://github.com/Bobnoddle/quark/commit/a3b36572a9119b9883775267801438246266e74b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Retry the lifecycle E2E once before failing the job
  
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

- [`cf9b36e`](https://github.com/Bobnoddle/quark/commit/cf9b36e4cb816f418851fea173c58220c995a44e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Split scaffolded projects' dependabot PRs by semver update type
  
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

- [#153](https://github.com/Bobnoddle/quark/pull/153) [`bdd0470`](https://github.com/Bobnoddle/quark/commit/bdd0470b3ce8100992e5a0a2bb08c37b2ec2ebb7) Thanks [@dependabot](https://github.com/apps/dependabot)! - Bump chalk 5→6, commander 14→15, execa 9→10 and @expo/vector-icons 14→15
  
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

- [#154](https://github.com/Bobnoddle/quark/pull/154) [`307d05d`](https://github.com/Bobnoddle/quark/commit/307d05d613966d2fcfb99be7b48b634b84fdd8cd) Thanks [@dependabot](https://github.com/apps/dependabot)! - Bump 16 minor dependencies, including next 16.3.6, react 19.3.0 and rrweb 2.1.6
  
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

- [`6d5faf2`](https://github.com/Bobnoddle/quark/commit/6d5faf247f659a7dedd87425edb481343f885cea) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop the lifecycle E2E from hanging after it passes
  
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

- [#149](https://github.com/Bobnoddle/quark/pull/149) [`0b147d8`](https://github.com/Bobnoddle/quark/commit/0b147d8fbf51436c461c56cebad37cc479a816a4) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Bump bullmq to v6 and ioredis to v6
  
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

- [#144](https://github.com/Bobnoddle/quark/pull/144) [`0e8e1bf`](https://github.com/Bobnoddle/quark/commit/0e8e1bf9fd4400a1c85be688739da2d7498284ad) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Detect when a project would be scaffolded inside an existing git repository: warn that the project folder will sit one level below the repository root, and skip git initialisation so a nested repository is never created. Prevents broken pnpm workspaces, turbo and CI workflows caused by a nested project folder.

- [#147](https://github.com/Bobnoddle/quark/pull/147) [`fae41f2`](https://github.com/Bobnoddle/quark/commit/fae41f280b90f1695d877b825ae79d31c874a75d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Make `createQueue()` close-safe and drop dead queue churn from worker preflight.
  
  - `createQueue(name)` now evicts a queue from the singleton registry when it is closed, so the next `createQueue(name)` returns a fresh, usable instance instead of the poisoned, already-closed one. Queues closed through another path are also detected and replaced, and `closeAllQueues()` iterates a snapshot of the registry while close evicts entries.
  - The worker `preflight()` health check no longer creates and immediately closes a queue per job queue — that code never used the queue and taught an unsafe pattern by example. Handler registration is now counted directly from the handler registry.

- [`a4f89e9`](https://github.com/Bobnoddle/quark/commit/a4f89e901a467cf302a0b613b77bb8afb77ceb37) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix 5 env/auth bugs in scaffolded and monorepo apps
  
  - `next.config.js` now falls back to `http://localhost:${PORT}` for `NEXTAUTH_URL`, so the client-side Auth.js base URL matches the dev port instead of hardcoded `localhost:3000`
  - Rate-limit keying uses a new `getClientIp()` helper (`x-forwarded-for` → `x-real-ip` → `unknown`) instead of the removed `NextRequest.ip`, which had collapsed every client into one shared bucket
  - `getAllowedOrigins()` derives dev origins from `process.env.PORT` (with `127.0.0.1` and next-dev host extras) instead of the hard-coded config default, and no longer concatenates ports as strings
  - `validateEnv()` now warns when `APP_URL` is missing in production/staging, where Auth.js and CORS silently fall back to `http://localhost`
  - Scaffolded `.env.example` gets an accurate APP_URL comment, a ≥32-character `NEXTAUTH_SECRET` placeholder (the old one failed startup validation), and a path-free `NEXTAUTH_URL` comment

- [`a79bda4`](https://github.com/Bobnoddle/quark/commit/a79bda48fc04a33fb865d7ad8f8239c6147ffd12) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix three scaffold-breaking bugs that made `test:build` (and the nightly Scaffold Container Security job) fail
  
  - **Corrupted initial migration.** `packages/db/prisma/migrations/20260202061128_initial/migration.sql` in the scaffold template began with Prisma's `Loaded Prisma config from prisma.config.js.` log line, captured because Prisma writes it to stdout and the diff was piped with `>`. Postgres rejected the migration with `42601 syntax error at or near "Loaded"`, so **every newly scaffolded project failed its first `db:migrate:deploy`**. `validate-template-migration.js` had been filtering that exact line out of its comparison, so it reported "matches the current schema" while shipping broken SQL — it now hard-fails on any non-SQL preamble, and a new `pnpm --filter @techstream/quark-create-app regen-migration` regenerates the file safely.
  - **Invalid second build scenario.** `test-build.js` scaffolded with `--packages cms`, which the CLI rejects (`Invalid packages: cms`), so the scenario always aborted before testing anything. It now covers `pwa` instead.
  - **PWA manifest conflict.** The `pwa` feature wrote `app/manifest.json` next to the base project's `app/manifest.js`, and Next.js failed the build with `Cannot find module for page: /manifest.webmanifest`. The feature now replaces `manifest.js` with the PWA variant.

- [`bd76583`](https://github.com/Bobnoddle/quark/commit/bd765830f782fdcb5778850f3d313b145ce015c5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Strip dev-only native binaries from the worker runtime image
  
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

- [`2c93c88`](https://github.com/Bobnoddle/quark/commit/2c93c888ccb13b6df4ff5441ef19b536b9cd1709) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync generated templates after the development dependency bump
  
  `sync-templates:check` (Template Drift Check) failed on `main` after the
  dependabot dev-dependency update, because the scaffold templates pin the same
  version ranges. Re-synced `apps/web`, `db`, `ui`, `worker`, and `mobile`
  template manifests so newly scaffolded projects install the current versions.

- [#145](https://github.com/Bobnoddle/quark/pull/145) [`3b429ab`](https://github.com/Bobnoddle/quark/commit/3b429ab982c8c6696d6852435ca6b3ac7090993d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix git hooks when a Quark project is scaffolded inside an existing git repository (monorepo, Conductor workspace).
  
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

- [#139](https://github.com/Bobnoddle/quark/pull/139) [`540d075`](https://github.com/Bobnoddle/quark/commit/540d07554d23ef9318346074dac5c756e4501123) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Migrate deploy CLI from deprecated railway.json Config as Code to Railway Infrastructure as Code (.railway/railway.ts). Adds railway config apply flow, IaC string escaping, deployment status verification, worker DB readiness checks, and public readiness files (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT).

## 1.22.0

### Minor Changes

- [#131](https://github.com/Bobnoddle/quark/pull/131) [`10cf35d`](https://github.com/Bobnoddle/quark/commit/10cf35d87ea02c22210aee85b41b32df79cc549c) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Remove domain vertical models (CRM, CMS, AI, Booking, Admin) from default scaffold. Domain features are now taught via embedded skills and added on demand, keeping the initial scaffold lean. The Prisma schema trimming logic (`trimPrismaSchema`) and domain-specific template directories (`admin/`, `admin-routes/`, `skills/admin-dashboard/`, `skills/ai/`, `skills/bookings/`, `skills/cms/`, `skills/crm/`) are removed.

### Patch Changes

- [#130](https://github.com/Bobnoddle/quark/pull/130) [`b3d07b4`](https://github.com/Bobnoddle/quark/commit/b3d07b4133bea19da7693b43fab2cced1cfb85cb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Apply optional chaining refactors and sync templates after Biome 2.5 upgrade

## 1.21.0

### Minor Changes

- [#105](https://github.com/Bobnoddle/quark/pull/105) [`8fd6870`](https://github.com/Bobnoddle/quark/commit/8fd6870dcf504d7b5090c9ceac9f5cadb4600292) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add optional PWA support as a scaffolded package. When selected via `--packages pwa`, the scaffold generates a Next.js native manifest (`app/manifest.json`), a vanilla service worker (`public/sw.js`) with cache-first static assets and network-first navigation, and a client component for SW registration. Zero external dependencies — no Workbox, no next-pwa, no config file modifications.

### Patch Changes

- [#116](https://github.com/Bobnoddle/quark/pull/116) [`7d1f5b7`](https://github.com/Bobnoddle/quark/commit/7d1f5b750b1502984a07f16e650afd71ffc7adad) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix incorrect relative import paths for jwt in auth API route templates

- [#119](https://github.com/Bobnoddle/quark/pull/119) [`f2ff17b`](https://github.com/Bobnoddle/quark/commit/f2ff17be10b869aa117decaa5b3bd80b6748c508) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync mobile template from monorepo source, add OTA runtimeVersion, reject mobile in create flow with guidance to use `quark add mobile`

- [#122](https://github.com/Bobnoddle/quark/pull/122) [`f719e69`](https://github.com/Bobnoddle/quark/commit/f719e694d0fb6fabb9a7a9537bce34ea88b8cd9e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add template drift prevention: generate-templates.js produces template-only files from source data, sync-watch.js provides real-time auto-sync during development.

## 1.20.1

### Patch Changes

- [#93](https://github.com/Bobnoddle/quark/pull/93) [`146915a`](https://github.com/Bobnoddle/quark/commit/146915af1082ec0f53f4a8cb803af716d9fb01de) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Auto-generate ADMIN_PASSWORD during scaffolding so `pnpm db:seed` works out of the box on fresh projects.

## 1.20.0

### Minor Changes

- [#87](https://github.com/Bobnoddle/quark/pull/87) [`3ed5109`](https://github.com/Bobnoddle/quark/commit/3ed510924b99e7efdbf09c197cba445806ee61f6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Bundle all embedded skills with every scaffold and remove the admin dashboard UI. The CLI no longer asks which skills to include — features are now `ui` and `jobs` only, and all skills (including a new `admin-dashboard` skill preserving the CRUD-generation patterns and a `quark-skills` index) ship with every build. The `admin`, `bookings`, `crm`, `cms`, and `ai` feature flags are removed; the dev seed no longer inserts domain-specific demo data; the scaffolded README now includes the `pnpm db:seed` step.

- [#83](https://github.com/Bobnoddle/quark/pull/83) [`2af89ff`](https://github.com/Bobnoddle/quark/commit/2af89ff6409fe6fa8904c52cccefaeeee4d68cbb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: make embedded skills harness-generic via --harness flag

  The embedded skills are no longer opencode-specific. The CLI now accepts a
  `--harness <opencode|claude|copilot>` flag (default `opencode`) and places the
  skills in the selected harness's auto-load directory (`.opencode/skills/`,
  `.claude/skills/`, or `.github/skills/`). The scaffolded docs and feature rows
  reference the selected harness's skill directory.

- [#85](https://github.com/Bobnoddle/quark/pull/85) [`c732267`](https://github.com/Bobnoddle/quark/commit/c73226748f76b554a35345b005fbe9a95eaf8a3b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Standardize scaffolded page-title convention: add getPageMetadata() helper to the web SEO lib, switch the title template separator from "·" to "|", and document page-title formulas in the seo skill and project context files.

### Patch Changes

- [#83](https://github.com/Bobnoddle/quark/pull/83) [`2af89ff`](https://github.com/Bobnoddle/quark/commit/2af89ff6409fe6fa8904c52cccefaeeee4d68cbb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - docs: enrich booking/CMS skills; remove stale vertical + agency docs

  - **Enriched the bookings skill** with the full booking schema (Staff, ServiceType, AvailabilitySlot, Booking), the booking status state machine, and scheduling rules.
  - **Enriched the CMS skill** with the content status lifecycle and media library model.
  - **Removed stale vertical docs** (`BOOKING-SYSTEM-DESIGN.md`, `CMS_OUTLINE.md`) — their domain knowledge is now in the skills.
  - **Removed agency docs** (Techstream pricing/marketing/strategy) and the stale business pitch — they belong in a separate repo.
  - **Removed leftover artifacts** (`technical-task.html`, `PLAN.md`, `PLAN_SUMMARY.md` archived to `reference/`).

- [#88](https://github.com/Bobnoddle/quark/pull/88) [`36c9ced`](https://github.com/Bobnoddle/quark/commit/36c9ced83208254190e9295db17af7b3077a9fa9) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - docs: replace remaining recipe terminology with skills across docs, CLI comments, and the reference archive README

- [#89](https://github.com/Bobnoddle/quark/pull/89) [`e14a134`](https://github.com/Bobnoddle/quark/commit/e14a1349843fec1ea24af02efe5a3841646b9aee) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Slim template footprint by excluding test files from scaffolded projects, reducing globals.css to essential design tokens, and trimming the example page. The sync-templates engine now removes locally-excluded files from templates (not just skips syncing them). Stale planning docs archived.

- [#86](https://github.com/Bobnoddle/quark/pull/86) [`ec97a10`](https://github.com/Bobnoddle/quark/commit/ec97a10d11ad6003daa31585b72952beafc5cccb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync pnpm.overrides from the monorepo root into the scaffold root template so scaffolded projects pick up security overrides (deepmerge-ts, fast-uri) and stop failing Trivy image scans.

## 1.19.1

### Patch Changes

- [#81](https://github.com/Bobnoddle/quark/pull/81) [`3834d86`](https://github.com/Bobnoddle/quark/commit/3834d869df94d1edc1b5d0a389ca3ae01fbfc002) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(smoke): approve msgpackr-extract build in standalone core check

  pnpm 10+ ignores build scripts not explicitly allowed, so the standalone core
  smoke check (`pnpm add @techstream/quark-core next react react-dom`) failed with
  `ERR_PNPM_IGNORED_BUILDS` for the transitive `msgpackr-extract` dependency. The
  smoke test now passes `--allow-build=msgpackr-extract`.

## 1.19.0

### Minor Changes

- [#79](https://github.com/Bobnoddle/quark/pull/79) [`900c3b7`](https://github.com/Bobnoddle/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: archive vertical packages and remove vertical code from the monorepo

  - **Archived the vertical packages** (`@techstream/quark-ai`, `@techstream/quark-cms`, `@techstream/quark-crm`, `@techstream/quark-bookings`) to `reference/verticals/packages/`. They are now reference implementations only — the skills point to them.
  - **Removed the vertical code from the monorepo's apps**: the AI/CRM/bookings API routes, the CMS content subsystem, and the worker AI handlers are gone from `apps/web` and `apps/worker`. The monorepo now reflects the minimal scaffold (infrastructure + skills).
  - The scaffold was already clean; this removes the vertical code from the monorepo's own reference apps.

- [#79](https://github.com/Bobnoddle/quark/pull/79) [`900c3b7`](https://github.com/Bobnoddle/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: make verticals skill-only; embed skills in .opencode/skills; rename recipe → skill

  - **Verticals are now skill-only**: `bookings`, `crm`, `cms`, and `ai` no longer scaffold starter code. Selecting one just recognizes the feature — the embedded skill (always present) teaches the AI to build it. The starter templates are archived to `reference/verticals/`.
  - **Skills embedded for auto-loading**: the skills moved from `skills/` to `.opencode/skills/`, the location opencode auto-loads on context match (no need to point the AI at them).
  - **`recipe` command renamed to `skill`**: `quark skill <feature>` prints an embedded skill.
  - **Skills enriched**: each vertical skill now includes example Prisma models, Zod validation schemas, and test patterns.
  - **Smoke test expanded**: verifies all embedded skills are present and the `skill` command works.

### Patch Changes

- [#79](https://github.com/Bobnoddle/quark/pull/79) [`900c3b7`](https://github.com/Bobnoddle/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(cli): make ui a required package so minimal scaffolds work

  The base web app (layout, auth, example-page) imports the `ui` package, but a
  minimal scaffold (`--features ""` or `--preset minimal`) did not include it,
  producing a broken scaffold that failed `pnpm doctor:ci`. `ui` is now always
  scaffolded (alongside `db` and `config`), and the web app dependency + `.quark-link.json`
  reflect it so the doctor check passes.

## 1.18.0

### Minor Changes

- [#78](https://github.com/Bobnoddle/quark/pull/78) [`234359a`](https://github.com/Bobnoddle/quark/commit/234359a2e13bc61a6d107397a0cdfeaafc7880c6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: replace recipes with embedded skills; archive bookings; remove worker AI subsystem

  - **Embedded skills**: replaced the `recipes/` prompt library with a `skills/` directory in the base scaffold. Ships skills for building bookings, CRM, CMS, and AI systems, plus generic skills (add-model, add-endpoint, add-dashboard). Each skill carries the domain context, Quark framework patterns, workflow, end-result shape, and a pointer to the archived reference implementation.
  - **CLI**: the `recipe` command now reads from `skills/`; feature rows/guides reference `skills/`; starter detection checks the API route instead of a recipe file.
  - **Archive bookings**: copied the bookings starter to `reference/verticals/bookings/` as the skill's reference.
  - **Worker AI subsystem removed**: the scaffolded worker no longer ships AI handlers/libs (`context-extraction`, `conversation-compact`, `openrouter`, `summarize`, `truncation`, `tools`) or AI job names — the AI skill teaches how to build them.
  - **Smoke test**: added a minimal-scaffold check that verifies the base scaffold has no demoted-vertical references and ships the embedded skills.

### Patch Changes

- [#76](https://github.com/Bobnoddle/quark/pull/76) [`6d037b3`](https://github.com/Bobnoddle/quark/commit/6d037b360b0959dd58b62903c01604650913af4f) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(scaffold): remove demoted vertical refs from base template; fix starter paths; add --skip-install to add

  - Removed orphaned references to the demoted vertical packages (`quark-ai`, `quark-cms`, `quark-crm`) from the base scaffold (web/worker `package.json`, `next.config` transpilePackages, `api/ai` + `api/admin/crm` routes, worker `ai.js`/`ai.test.js`). These are now AI skills, not scaffolded packages.
  - Fixed a wrong relative import in all four domain starters (`bookings`, `crm`, `cms`, `ai`): `route.js` used `../../error-handler` (resolved to `app/error-handler`, wrong) instead of `../error-handler`. This broke `pnpm build`.
  - Added `--skip-install` support to the `add` command (previously ignored due to a commander option-shadowing quirk), fixing a flaky `add <feature>` test that timed out during dependency installation.

## 1.17.1

### Patch Changes

- [#74](https://github.com/Bobnoddle/quark/pull/74) [`7e4c315`](https://github.com/Bobnoddle/quark/commit/7e4c31586e942034ca78ed1a1675b27226a41b81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(scaffold): scaffolded web tests fail out of the box

  A freshly scaffolded project's `pnpm test` failed because the web test script
  (`node --test 'src/**/*.test.js'`) was missing the `--experimental-test-module-mocks`
  flag and ran integration tests that the monorepo excludes. The scaffold now ships
  `scripts/run-tests.mjs` (matching the monorepo runner) and the web test script uses
  `node ../../scripts/run-tests.mjs src --exclude=integration.test.js`. Scaffolded web
  tests pass 56/56 and db tests 52/52.

## 1.17.0

### Minor Changes

- [#71](https://github.com/Bobnoddle/quark/pull/71) [`592e0ea`](https://github.com/Bobnoddle/quark/commit/592e0ea81a41cc61b49b1834f0985e319a47998a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: scaffold opinionation reduction — API-first, two-view CLI, minified admin + verticals

  Quark becomes API-first with AI-assisted scaffolding:

  - **Two-view CLI**: Human View (product-shaped questions + advanced config) and AI View (`--features`, `--preset`, `--prompt`, `--no-prompts`), plus a `recipe <feature>` command that prints an AI prompt recipe.
  - **Minified admin**: neutral operations shell (`_patterns/` Dashboard/ActionForm/DeployPanel + auto-CRUD fallback), no themed UI imports, no design-language leak into user pages.
  - **Verticals → domain starters**: bookings/crm/cms/ai are now generic endpoint + Prisma model + recipe, scaffolded on demand instead of full packages.
  - **Prompt Library**: `recipes/` core set (add-model, add-endpoint, add-dashboard) + per-feature recipes.
  - **`MAIN.md`**: single agent entry point linking CLAUDE.md, docs/, openapi.yaml, and recipes/.
  - **Package scope reduction**: verticals removed from the default feature list; originals archived to `reference/`.
  - **Fixes**: pass model name to `isListVisible` so per-model hidden fields are honored; fix `MAIN.md` brief placeholder replacement.

### Patch Changes

- [#64](https://github.com/Bobnoddle/quark/pull/64) [`66b8cb6`](https://github.com/Bobnoddle/quark/commit/66b8cb6819bbf884e02c0cc0c3b55d07b9adb599) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(ci): auto-sync scaffold templates during release to prevent drift

  The release workflow bumps package versions via changesets but never
  re-synced scaffold templates, so every release created template drift
  that blocked unrelated PRs. Templates are now re-synced inside the
  changesets version step, and CHANGELOG.md files are excluded from sync
  since they are release artifacts, not scaffold content.

## 1.16.0

### Minor Changes

- [`c20e541`](https://github.com/Bobnoddle/quark/commit/c20e541b3c6690fda859b1c2b997b81ddea280bf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - AI chat system, UI theming engine, SMS service, CRM package, and expanded deployment tooling

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

- [#58](https://github.com/Bobnoddle/quark/pull/58) [`1b38b14`](https://github.com/Bobnoddle/quark/commit/1b38b140456470b4add3e9c2bde2f7bf3d16891b) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Enhanced media management UI with inline image editing, drag-and-drop page builder improvements, and admin navigation updates

### Patch Changes

- [`1191466`](https://github.com/Bobnoddle/quark/commit/119146639f0e53028ebe0a999ecc3008dd23ce67) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix OpenRouter error classification and max-rounds behavior in AI worker

  - **Error classification**: Change remaining `AppError` throws in the streaming code path to `ServiceError("OpenRouter", ...)` for proper external-service error handling (OpenRouter API errors, missing response body, retry exhaustion)
  - **Graceful max-rounds**: Replace `throw new AppError` when the tool-calling loop exceeds 20 rounds with a graceful return that includes `truncated: true` and an assistant hint message, preventing conversation crashes

## 1.15.0

### Minor Changes

- [`9e85dba`](https://github.com/Bobnoddle/quark/commit/9e85dba8de2031c91eb129c459110cb105d87fce) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor CMS page builder by removing background animation support in favor of a simpler color-only background model, add HTML sanitization utilities, and replace the `section`/`photo-gallery`/`form` UI components with more focused `container`/`lightbox`/`form-field` alternatives across scaffolded projects.

- [`ad311a8`](https://github.com/Bobnoddle/quark/commit/ad311a8967c32b13c5f5d16303f6cc57dc2abd3a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Improve the scaffold DX in `quark-create-app` with clearer onboarding docs, feature-specific scaffold guidance, and a read-only scaffold drift checker with CI-friendly failure mode.

### Patch Changes

- [#54](https://github.com/Bobnoddle/quark/pull/54) [`799f9ba`](https://github.com/Bobnoddle/quark/commit/799f9ba87f8797d75ce3526ac5379975417cd7c1) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Fix scaffolded route generation and tests for page-content migration behavior, and align build-time slug prerendering with CI environments that do not provide database variables.

## 1.14.0

### Minor Changes

- [#47](https://github.com/Bobnoddle/quark/pull/47) [`8be648c`](https://github.com/Bobnoddle/quark/commit/8be648cd739c843c905ec2fce541875d8e00b094) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Add the expanded playground and scaffolded UI component updates to `quark-create-app`, harden scaffold parity with runtime standards checks, JavaScript Prisma config support, and worker/auth validation improvements, and ship the related auth-secret fallback and storage path handling fixes in `quark-core`.

## 1.13.4

### Patch Changes

- [`e9411f9`](https://github.com/Bobnoddle/quark/commit/e9411f9e1d91ad13cb496e4645d15ba2aff6080d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Split CMS into an explicit scaffold feature instead of bundling it into `admin`, automatically include its current dependencies, and make generated admin routes work cleanly when CMS is not installed.

## 1.13.3

### Patch Changes

- [`3cecbed`](https://github.com/Bobnoddle/quark/commit/3cecbeddf1a5764c72688ed0d36c52c95a16eae5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Update scaffolded Railway web deployment guidance to use the correct Next.js standalone server path and preserve static/public assets during the build so production CSS and JS load correctly.

## 1.13.2

### Patch Changes

- [`d49c064`](https://github.com/Bobnoddle/quark/commit/d49c0649e6e8759eb1a8abd37887dabe8aaaffdf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Preserve NextRequest semantics when normalizing forwarded development auth requests in scaffolded apps.

- [`274bf3d`](https://github.com/Bobnoddle/quark/commit/274bf3dabacc7c517561512c7ddf0e8379d0b09a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Export the documented `auth`, `errors`, and `storage` subpaths from `@techstream/quark-core`, and update scaffolded app manifests so installs set up git hooks without module-type or ignored-build-script warnings.

## 1.13.1

### Patch Changes

- [`5a360a9`](https://github.com/Bobnoddle/quark/commit/5a360a979d1a021969680386b4f9adfbc3335308) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix admin scaffolding so Quark create and add also include the CMS package and routes, rewrite generated workspace package names consistently, and keep optional package dependencies installable in generated apps.

## 1.13.0

### Minor Changes

- [`cd830d9`](https://github.com/Bobnoddle/quark/commit/cd830d95a3ef66d37b2a0f28d21c910a75d84d1e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add CMS scaffolding, media management flows, security contact metadata, and release-tooling improvements to the Quark CLI templates.

  This release also hardens template sync by excluding local uploads from generated scaffolds.

## 1.11.0

### Minor Changes

- [`b07c53a`](https://github.com/Bobnoddle/quark/commit/b07c53af1ef756e0dfb89a03ee011f7a91406438) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - **CLI:** Add `--admin-routes` scaffold flag that generates a full admin panel - CRUD route handlers, field renderer, model table/form components, sidebar, sign-out button, and a dashboard data helper. Admin template now ships with `field-map`, `introspect`, and `query` utilities.

  **CLI:** Update `ui` template with `ErrorBanner`, `RichText`, and updated `ThemeProvider`/theme toggle components. Update `base-project` template with registration, forgot-password, and sign-out auth pages, a floating theme toggle, and revised seed/query helpers. Update `worker` template with default email and file job handlers.

  **Core:** Pre-register queue metrics as named exports from `@techstream/quark-core`: `jobQueueDepth` (gauge), `jobsProcessedTotal` (counter), and `jobDuration` (histogram). Wire `completed` and `failed` worker event handlers to record these metrics automatically. Add `getRegisteredQueues()` and `updateQueueDepths()` helpers so workers can periodically refresh the queue-depth gauge.

## 1.10.0

### Minor Changes

- [`9c7ea5f`](https://github.com/Bobnoddle/quark/commit/9c7ea5fbf92037fca1a3193de27e2139d8edba30) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-create-app

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

- [`fb110e7`](https://github.com/Bobnoddle/quark/commit/fb110e755664ac70ccea7d768a35bd87f72c1492) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-core

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

- [`68c1aa1`](https://github.com/Bobnoddle/quark/commit/68c1aa12253d66779620b18654a8dc8b6baa8d81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add flexible CLI options and comprehensive test coverage for project scaffolding:

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

- [`e41d79e`](https://github.com/Bobnoddle/quark/commit/e41d79e8a44b2a4d1a0799ca1fecc282b58b4524) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor database connection string logic and enhance environment validation:

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

- [`1fd64b1`](https://github.com/Bobnoddle/quark/commit/1fd64b14d9bce32ca8f3246127e1134d0fb1a3aa) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## Production-Readiness Update

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

- [`5069069`](https://github.com/Bobnoddle/quark/commit/50690698d4fe1daeaa7f5b49bfb20a97074a2744) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add query builder utilities with search/sort support and introduce request/response logging middleware. Improve CLI docs and add optional build verification test, plus checklist updates.

- [`f142e9c`](https://github.com/Bobnoddle/quark/commit/f142e9c57dcac93bfe90bae757ed4126f989a888) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix: complete file upload template, fix migration drift, and clean up orphaned Docker volumes

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

- [`399e7da`](https://github.com/Bobnoddle/quark/commit/399e7da083f26cb1d0196a467e78500129eba4ce) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix: update CLI output and add `quark-update` bin alias

  - Register `quark-update` as a bin alias so `npx quark-update` works
  - Fix post-scaffolding output to show `npx @techstream/quark-create-app update`

## 1.5.1

### Patch Changes

- [`39a99c2`](https://github.com/Bobnoddle/quark/commit/39a99c2c2723cc533126531ced2d610ea10353a8) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - chore: normalize package scopes to @techstream in CLI templates

  - Rename `@quark/web` → `@techstream/quark-web` in scaffolded projects
  - Rename `@quark/worker` → `@techstream/quark-worker` in scaffolded projects
  - Normalize template versions to 1.0.0

## 1.5.0

### Minor Changes

- [`590592d`](https://github.com/Bobnoddle/quark/commit/590592d87c8dc796fc8025643997b0b0d31cceef) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: add file upload, validation, and storage system

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

- [`17656c6`](https://github.com/Bobnoddle/quark/commit/17656c684cd826d8026573b44ae271c197a9110b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add automated release pipeline with Changesets
