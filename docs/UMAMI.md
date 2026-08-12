# Umami Integration

Quark's recommended default is a dormant Umami baseline in every scaffolded Next.js app. Analytics stays off until the public Umami URL and website ID are both present, and replay stays off until it is explicitly enabled.

## Recommendation

- Load `script.js` from `NEXT_PUBLIC_UMAMI_URL` in the root layout head.
- Enable Umami Performance on the main tracker by default when base analytics is already enabled.
- Keep Umami helpers app-local in `apps/web/src/lib/analytics/*` and sync them into the scaffold templates. Do not move vendor-specific code into `@techstream/quark-core`.
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
| `apps/web/src/lib/analytics/umami-config.js` | Normalize URL, derive origin and dns-prefetch hint, build `script.js` URL, expose `enabled` and `replayEnabled` |
| `apps/web/src/lib/analytics/umami.js` | Thin client wrapper for `track()`, `identify()`, and optional revenue helpers |
| `apps/web/src/lib/analytics/umami-marketing.js` | Dormant helpers for campaign URLs, dashboard-generated Umami Links, Pixels, and marketing-email snippets |
| `apps/web/src/lib/analytics/umami-replay.js` | Replay defaults, buffering, session-cache waiting, and `/api/record` payload helpers |
| `apps/web/src/app/_components/UmamiReplayRecorder.js` | Local rrweb recorder that waits for `window.umami.getSession().cache`, batches events, flushes on hidden/pagehide, and checkpoints across App Router transitions |
| `apps/web/src/app/layout.js` | Adds preconnect, dns-prefetch, a deferred `script.js` tag with `data-performance="true"`, and conditionally mounts the replay recorder |
| `apps/web/src/proxy.js` and `apps/web/next.config.js` | Derive Umami CSP allowlists from shared config instead of hardcoded hosts |
| `packages/config/src/validate-env.js` | Validates the three-variable contract and replay preconditions |
| `apps/web/.env.example` | Documents the public Umami setup without adding extra env sprawl |

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

- Use a deferred `script` tag in the layout head for `script.js` so the tracker can bootstrap in parallel before replay polling begins.
- Add `data-performance="true"` to the main tracker when a site is already opted into Umami analytics.
- Derive `script-src` and `connect-src` from the normalized Umami origin.
- Preserve development-only `unsafe-eval` where Turbopack still requires it.
- Do not send PII in events, replay metadata, or session properties.
- Wait for `window.umami.getSession().cache` before starting rrweb capture; the main tracker owns the session token.
- Add `data-umami-block` to any subtree that should be excluded from replay capture, such as payment, secrets, or support-case content.
- Use dashboard-generated Links for campaigns, newsletters, PDFs, QR codes, or other external surfaces. Use dashboard-generated Pixels only in HTML emails or external pages where JavaScript cannot run.

After changing the monorepo source, sync the scaffold templates:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```