# Umami Integration

Quark's recommended default is a dormant Umami baseline in every scaffolded Next.js app. Analytics stays off until the public Umami URL and website ID are both present, and replay stays off until it is explicitly enabled.

## Recommendation

- Load `script.js` from `NEXT_PUBLIC_UMAMI_URL` in the root layout head.
- Enable Umami Performance on the main tracker by default when base analytics is already enabled.
- Keep Umami helpers app-local in `apps/web/src/lib/analytics/*` and sync them into the scaffold templates. Do not move vendor-specific code into `@techstream/quark-core`.
- Use a local `rrweb` client component for replay uploads instead of Umami's hosted `recorder.js`.
- Gate replay separately behind `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED`.
- Keep replay tuning in code defaults unless a project proves it needs runtime overrides.

## Public Env Contract

Scaffolded apps should expose only these three public variables by default:

- `NEXT_PUBLIC_UMAMI_URL` — absolute Umami base URL, for example `https://stats.example.com`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` — public website UUID used by `script.js` and replay uploads
- `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED` — boolean-like flag that enables the local rrweb recorder

Behavior rules:

- Base analytics is enabled only when URL and website ID are both present.
- Base analytics disables cleanly when either value is absent.
- Performance rides on the same base analytics gate via `data-performance="true"` on the main tracker.
- Replay requires the full base analytics contract plus `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED=true`.
- Validation should warn when only one of URL or website ID is set.

## Scaffolded Runtime Shape

The generated web app should include these surfaces:

| Surface | Purpose |
|---|---|
| `apps/web/src/lib/analytics/umami-config.js` | Normalize URL, derive origin and dns-prefetch hint, build `script.js` URL, expose `enabled` and `replayEnabled` |
| `apps/web/src/lib/analytics/umami.js` | Thin client wrapper for `track()`, `identify()`, and optional revenue helpers |
| `apps/web/src/lib/analytics/umami-replay.js` | Replay defaults, buffering, session-cache waiting, and `/api/record` payload helpers |
| `apps/web/src/app/_components/UmamiReplayRecorder.js` | Local rrweb recorder that waits for `window.umami.getSession().cache`, batches events, flushes on hidden/pagehide, and checkpoints across App Router transitions |
| `apps/web/src/app/layout.js` | Adds preconnect, dns-prefetch, `script.js` with `data-performance="true"`, and conditionally mounts the replay recorder |
| `apps/web/src/proxy.js` and `apps/web/next.config.js` | Derive Umami CSP allowlists from shared config instead of hardcoded hosts |
| `packages/config/src/validate-env.js` | Validates the three-variable contract and replay preconditions |
| `apps/web/.env.example` | Documents the public Umami setup without adding extra env sprawl |

## Replay Defaults

Replay remains app-local and uses code defaults that mirror Umami's recorder behavior closely enough for App Router apps:

- sample rate: `0.15`
- flush interval: `10000` ms
- flush event count: `100`
- max duration: `300000` ms
- masking: `moderate` by default with `maskAllInputs: true`
- unload behavior: `keepalive` only when the payload stays under the browser body limit

These defaults belong in code, not in additional public environment variables.

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
- marketing links or pixels in the base app

Those can be added later by projects that need them, but they should not widen the default contract.

## Implementation Notes

- Use `next/script` in the layout head for `script.js`.
- Add `data-performance="true"` to the main tracker when a site is already opted into Umami analytics.
- Derive `script-src` and `connect-src` from the normalized Umami origin.
- Preserve development-only `unsafe-eval` where Turbopack still requires it.
- Do not send PII in events, replay metadata, or session properties.
- Wait for `window.umami.getSession().cache` before starting rrweb capture; the main tracker owns the session token.
- Add `data-umami-block` to any subtree that should be excluded from replay capture, such as payment, secrets, or support-case content.

After changing the monorepo source, sync the scaffold templates:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```