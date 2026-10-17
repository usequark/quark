# Umami Integration

Quark's recommended default is a dormant Umami baseline in every scaffolded Next.js app. Analytics stays off until the public Umami URL and website ID are both present, and replay stays off until it is explicitly enabled.

## Recommendation

- Serve the tracker first-party from `/s/script.js` (Route handler, **not** a rewrite: rewrites proxy request headers unchanged and would forward app session cookies to the analytics host) with `data-host-url="/s"` so beacons POST same-origin.
- Enable Umami Performance on the main tracker by default when base analytics is already enabled.
- Keep Umami helpers app-local in `apps/web/src/lib/analytics/*` and sync them into the scaffold templates. Do not move vendor-specific code into `@usequark/quark-core`.
- Use a local `rrweb` client component for replay uploads instead of Umami's hosted `recorder.js`.
- Gate replay separately behind `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED`.
- Include dormant helpers for dashboard-generated Umami Links, Pixels, and marketing-email surfaces without adding extra public env vars.
- Keep replay tuning in code defaults unless a project proves it needs runtime overrides.

## Public Env Contract

Scaffolded apps should expose only these three public variables by default:

- `NEXT_PUBLIC_UMAMI_URL` - absolute Umami base URL, for example `https://stats.example.com`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` - public website UUID used by `script.js` and replay uploads
- `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED` - boolean-like flag that enables the local rrweb recorder

Behavior rules:

- Base analytics is enabled only when URL and website ID are both present.
- Base analytics disables cleanly when either value is absent.
- Performance rides on the same base analytics gate via `data-performance="true"` on the main tracker.
- Replay requires the full base analytics contract plus `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED=true`.
- Links and Pixels stay dormant until a project uses dashboard-generated tracking URLs through the scaffold helpers.
- Validation should warn when only one of URL or website ID is set.

## Scaffolded Runtime Shape

The generated web app should include these surfaces:

| Surface | Purpose |
|---|---|
| `apps/web/src/lib/analytics/umami-config.js` | Normalize upstream URL (server-only override first), expose first-party proxy URLs (`/s/script.js`, `/s/api/*`), expose `enabled` and `replayEnabled` |
| `apps/web/src/lib/analytics/umami.js` | Thin client wrapper for `track()`, `identify()`, and optional revenue helpers |
| `apps/web/src/lib/analytics/umami-marketing.js` | Dormant helpers for campaign URLs, dashboard-generated Umami Links, Pixels, and marketing-email snippets |
| `apps/web/src/lib/analytics/umami-replay.js` | Replay defaults, buffering, session-cache waiting, and first-party `/s/api/record` payload helpers |
| `apps/web/src/app/_components/UmamiReplayRecorder.js` | Local rrweb recorder that waits for `window.umami.getSession().cache`, batches events, flushes on hidden/pagehide, and checkpoints across App Router transitions |
| `apps/web/src/app/s/script.js/route.js` | First-party tracker proxy: GET-only, forwards no client headers (no cookies), strips `Set-Cookie`, public caching |
| `apps/web/src/app/s/api/[endpoint]/route.js` | First-party ingest proxy: POST-only whitelist (`send`, `collect`, `record`), strips credentials, forwards geo headers, `no-store`, endpoint-aware fail-open 202 |
| `apps/web/src/app/layout.js` | Deferred first-party `script.js` tag (`src="/s/script.js"`, `data-host-url="/s"`) with `data-performance="true"`, and conditionally mounts the replay recorder. No cross-origin preconnect — same-origin needs none |
| `apps/web/src/proxy.js` and `apps/web/next.config.js` | CSP stays `'self'`-only for analytics (no Umami origin allowlist); no `rewrites()` — `/s/*` is served by Route Handlers so credentials are never proxied |
| `packages/config/src/validate-env.js` | Validates the three-variable contract and replay preconditions, plus optional server-only `UMAMI_UPSTREAM_URL` / `UMAMI_URL` override |
| `apps/web/.env.example` | Documents the public Umami setup without adding extra env sprawl |

## First-Party Proxy Shape

Tracker, web-vitals beacons, and replay batches never touch the upstream
host from the browser:

| First-party | Upstream | Transport |
|---|---|---|
| `GET /s/script.js` | `${UMAMI}/script.js` | Route handler (forwards **no** client headers — rewrites would leak app cookies) |
| `POST /s/api/send` | `${UMAMI}/api/send` (tracker + web-vitals CWV custom events) | Route handler (strips credentials, forwards geo) |
| `POST /s/api/collect` | `${UMAMI}/api/collect` (legacy alias, pre-v2 Umami only) | Same handler, whitelisted — nothing in the scaffold posts here anymore |
| `POST /s/api/record` | `${UMAMI}/api/record` (replay) | Same handler, whitelisted |

Web-vitals posts custom events through `/api/send` with the send schema
(`{ type: "event", payload: { website, name: "cwv", data, url, hostname } }`):
Umami derives the event type server-side from `name` and persists
`name`/`data`. An earlier revision posted `event_name`/`event_data` keys to a
nonexistent `/api/collect` endpoint — silently dropped upstream while
recording nothing. Pin the schema with `umami-web-vitals.test.js`, not just
the URL.

Visitor IP resolution prefers `CF-Connecting-IP`, but only with explicit
opt-in (`TRUST_CF_CONNECTING_IP=true`, for Cloudflare-fronted deployments):
Cloudflare overwrites it while Railway replaces `X-Forwarded-For` with the
edge address, so XFF alone misattributes geo and rotating edge IPs split
Umami's `hash(IP, UA, site)` session identity into duplicates. Unconditional
trust would let any client override a legitimate XFF (most proxies pass the
CF header through unsanitized), hence default-off — unlike
`TRUST_PROXY_HEADERS`, which is default-on. Only the single resolved IP
crosses to upstream — never the chain — and `CF-Connecting-IP` passthrough
follows the same opt-in. Both drop to `"unknown"` when
`TRUST_PROXY_HEADERS=false`.

`/s/*` never starts with `/api/`, so the `proxy.js` rate limiter does not
apply — no exemption change needed, and analytics beacons must never 429.
CSP is `'self'`-only for analytics in both `next.config.js` headers and
`proxy.js` security headers.

## Replay Defaults

Replay remains app-local and uses code defaults that mirror Umami's recorder behavior closely enough for App Router apps:

- sample rate: `1` (validate end-to-end at 100% before lowering)
- flush interval: `10000` ms
- flush event count: `100`
- max duration: `300000` ms
- masking: `moderate` by default with `maskAllInputs: true`
- session-cache wait: polls indefinitely until `window.umami.getSession().cache` appears (abortable); a fixed timeout silently dropped every session on slow networks
- unload behavior: `keepalive` only when the payload stays under the browser body limit
- server rejection: a `200` with `{ ok: false, reason }` (e.g. replay disabled server-side) is treated as a failure — events are restored and retried instead of silently dropped

These defaults belong in code, not in additional public environment variables.

## Links, Pixels, And Marketing Email Surfaces

Umami Links and Pixels are generated in the Umami dashboard, not derived from runtime env vars.
Quark still includes dormant helper surfaces so projects can use those assets later without adding framework complexity:

- `buildCampaignUrl()` appends standard UTM params to relative or absolute campaign URLs.
- `resolveUmamiLinkHref()` prefers a dashboard-generated Umami Link when one exists and falls back to the canonical destination.
- `getUmamiPixelProps()` returns a hidden image payload for external pages that cannot load the main tracker.
- `getUmamiEmailPixelHtml()` returns a dormant HTML snippet for custom email templates when a project decides to track opens.

These helpers are intentionally dormant:

- no extra public env vars are required
- no extra script is loaded in the app shell
- no Links or Pixels are generated automatically by the scaffold

Use them only for external campaigns, HTML emails, or other surfaces where the main tracker cannot run. Do not replace normal internal app navigation with marketing redirects.

## Why This Shape Fits Quark

- It keeps analytics optional without introducing another scaffold branch.
- It works for both static and SPA-style App Router navigation because replay flushes before route snapshots.
- It keeps CSP configuration aligned with the actual runtime URL instead of copying a hardcoded analytics host through templates.
- It avoids a vendor-specific shared runtime package while still giving every generated project a ready-to-use baseline.

## Not Recommended By Default

Quark does not recommend these as scaffold defaults:

- hosted `recorder.js`
- extra public env knobs for replay sampling or masking
- auto-enabled replay
- auto-generated marketing links or auto-injected pixels in the base app

Those can be added later by projects that need them, but they should not widen the default contract.

## Implementation Notes

- Use a deferred first-party `script` tag (`src="/s/script.js"`, `data-host-url="/s"`) so the tracker bootstraps in parallel before replay polling begins.
- Add `data-performance="true"` to the main tracker when a site is already opted into Umami analytics. Known display artifact: Umami's sessions list groups by `(session_id, hostname)` and performance beacons save with no hostname, so each session renders as twin rows (one with views, one with 0 views). This is upstream query behavior, not a proxy bug — keep the flag for the metrics unless the twins annoy.
- Keep `script-src` and `connect-src` at `'self'` for analytics — the proxy is same-origin, so no Umami host ever enters CSP.
- Replay batches are chunked client-side to stay under the proxy's 1 MB cap (single poison events are dropped with a warning, never retried forever). Proxy fail-open is endpoint-aware: `record` answers `{ ok: false }` so batches are retained, `send` (tracker + web-vitals) and legacy `collect` answer `{ ok: true }` (fire-and-forget, no retry path).
- Operate the proxy with `UMAMI_UPSTREAM_URL` (server-only, preferred) falling back to `NEXT_PUBLIC_UMAMI_URL` for the handler destination. Both are resolved at request time (not build time), so an upstream change needs only a restart, not a rebuild.
- Browser code must use `getUmamiClientConfig()` (website ID + static proxy paths only), never the server `getUmamiConfig()`, so the analytics host cannot end up in client bundles. Verify with `grep -r <umami-host> .next/static` — it must be empty.
- Client env defaults must stay literal `process.env.NEXT_PUBLIC_*` member expressions (see `readPublicEnv()`): bare `process` does not exist in browsers, so a `process.env` default throws on every no-arg browser call and silently kills track(), web-vitals, and replay.
- The inline before-send script must assign the embedded helper via `var` (`var shouldBlockUmamiPayload=<fn>;`): production minification can drop the function name from `.toString()`, and a bare anonymous `function(...){...}` statement is a SyntaxError that kills the whole tag.
- Preserve development-only `unsafe-eval` where Turbopack still requires it.
- Do not send PII in events, replay metadata, or session properties.
- Wait for `window.umami.getSession().cache` before starting rrweb capture; the main tracker owns the session token.
- Add `data-umami-block` to any subtree that should be excluded from replay capture, such as payment, secrets, or support-case content.
- Use dashboard-generated Links for campaigns, newsletters, PDFs, QR codes, or other external surfaces. Use dashboard-generated Pixels only in HTML emails or external pages where JavaScript cannot run.

After changing the monorepo source, sync the scaffold templates:

```bash
pnpm --filter @usequark/quark-create-app sync-templates
```