# Umami Integration

This document reviews how Quark should support Umami as an optional, first-class analytics integration.

## Recommendation

- Ship a dormant Umami baseline in every scaffolded web app and enable it only when `NEXT_PUBLIC_UMAMI_URL` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` are set.
- Keep Umami helpers app-local in `apps/web/src/lib/analytics/umami.js` and the scaffold templates, not in `@techstream/quark-core`. Quark core is published and should stay vendor-neutral.
- Update both CSP surfaces: `apps/web/next.config.js` and `apps/web/src/proxy.js`.
- Treat most Umami capabilities as documentation and instrumentation problems, not framework code problems. Stable URLs, event names, properties, tags, and session data are what unlock the analysis screens.
- Do not add a new CLI feature flag in the first pass. The existing `base-project` template plus env gating is already enough to make Umami optional.

## Why This Shape Fits Quark

- It keeps Umami optional without introducing another scaffold branch.
- It avoids hard-coupling a published runtime package to a specific analytics vendor.
- It matches Quark's current `apps/web` plus `base-project` template model.
- It keeps staging and preview traffic out of production analytics by default through env gating and optional `data-domains`.
- It lets the generated project start simple while still supporting advanced Umami features later.

## Quark Touch Points

| Surface | Change | Why |
|---|---|---|
| `apps/web/src/app/layout.js` | Add a gated `next/script` tag for `umami.js` with optional tracker attributes | Primary tracker bootstrapping point |
| `apps/web/src/proxy.js` | Add conditional Umami host allowlisting to `script-src` and `connect-src` | Runtime CSP coverage |
| `apps/web/next.config.js` | Mirror the same CSP logic in `headers()` | Fallback CSP for routes outside proxy coverage |
| `apps/web/.env.example` | Document Umami env vars and production-only usage | Discoverability and setup |
| `apps/web/src/lib/analytics/umami.js` | Add thin `track()`, `identify()`, and optional revenue helpers | Consistent instrumentation surface |
| `packages/cli/templates/base-project/apps/web/*` | Receive the same source changes after template sync | Scaffold parity |
| Project docs | Add an Umami guide covering setup, taxonomy, goals, funnels, and client usage | Analysis quality depends on conventions, not just script install |

## Recommended Environment Variables

Required for baseline tracking:

- `NEXT_PUBLIC_UMAMI_URL`: The public Umami host, for example `https://stats.example.com`.
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`: The Umami website ID for the production site.

Recommended optional variables:

- `NEXT_PUBLIC_UMAMI_DOMAINS`: Comma-separated hostnames to keep tracking scoped to production domains.
- `NEXT_PUBLIC_UMAMI_TAG`: Stable tag for experiments or tenant-level filtering.
- `NEXT_PUBLIC_UMAMI_TRACK_PERFORMANCE`: Enable Core Web Vitals collection with `data-performance="true"`.
- `NEXT_PUBLIC_UMAMI_RESPECT_DNT`: Enable `data-do-not-track="true"`.

Advanced features should remain opt-in. Replays, revenue tracking, and any server-side Collect API usage should be documented and enabled only when the project actually needs them.

## Feature Matrix

| Feature | Site-side requirement | Quark recommendation |
|---|---|---|
| Filters | No extra code beyond meaningful URLs, events, tags, UTM parameters, and session properties | Documentation only. Teach teams to keep names and properties stable. |
| Segments | Saved filters in Umami | Documentation only. Provide starter segment recipes in the guide. |
| Cohorts | Stable page paths or event names over time | Documentation only. Useful once event taxonomy is settled. |
| Sessions | Optional `identify()` session data for plan, role, source, or tenant | Add an app-local `identify()` helper and document non-PII session properties. |
| Replays | Separate `recorder.js` script plus sample rate, mask level, max duration, and block selectors | Advanced opt-in only. Never enable by default. Require privacy review and masking. |
| Performance | Add `data-performance="true"` to `umami.js` | Optional env-gated enhancement. Good second-phase default for SEO-sensitive sites. |
| Compare | Dashboard-native date comparison | Documentation only. No special Quark code needed. |
| Breakdown | Stable event properties, tags, and URL/session fields | Baseline instrumentation should support this through consistent property naming. |
| Goals | Canonical paths or event names for conversion points | Ship default documentation for common Quark goals such as CTA clicks, registrations, and successful form submits. |
| Funnel | Ordered paths or events | Ship a starter funnel map in the docs for common product and marketing journeys. |
| Journey | Stable URLs and events | Documentation only. Enabled automatically once the baseline taxonomy is good. |
| Retention | Returning visitors plus consistent event/page structure | Documentation only. No extra Quark code required. |
| UTM | Tagged campaign URLs | Documentation only. Explain naming conventions for campaign links. |
| Revenue | Event payloads containing `revenue` and `currency` | Advanced helper only for commerce flows. Do not add revenue events to non-commerce starters. |
| Attribution | Conversion goals plus referrer and UTM data | Documentation only after goals and events are established. |
| Links | Use Umami-generated redirect links in campaigns and off-site placements | Add a client-facing playbook. Do not replace internal app navigation with Umami links. |
| Pixels | Use Umami-generated pixels in HTML emails or non-JS external surfaces | Add a client-facing playbook. Do not inject pixels into app pages already using the tracker script. |

## What Quark Should Support By Default

The default scaffold should make these easy immediately:

- Installing `umami.js` with `next/script` and `afterInteractive`.
- Conditionally allowlisting the Umami host in `script-src` and `connect-src`.
- A small app-local analytics wrapper for `track()` and `identify()`.
- A documented event taxonomy for goals, funnels, breakdowns, and attribution.
- Production-domain gating through env vars, not `NODE_ENV` alone.

The default scaffold should not enable these automatically:

- Replays.
- Revenue tracking.
- Pixels.
- Marketing links.

Those features are powerful, but they are product- and policy-dependent.

## Client Playbook For Links And Pixels

Links and Pixels are useful for clients, but they belong to a different operating model than in-app event tracking.

Use Links when the traffic source starts outside the site:

- newsletters
- paid ads
- social bios
- QR codes
- downloadable PDFs
- affiliate placements

Recommended rule: pair every Umami Link with a UTM naming convention so campaign data and click-through tracking stay aligned.

Use Pixels when JavaScript is unavailable or undesirable:

- HTML email opens
- hosted landing pages outside the main app
- external documentation portals that only support image tags

Recommended rule: pixels should be owned by marketing or lifecycle teams, documented alongside privacy expectations, and never used to double-count views already captured by `umami.js`.

## Implementation Order

1. Baseline web integration: `umami.js`, env vars, CSP, app-local wrapper, and docs.
2. Analysis-ready taxonomy: goals, funnels, journey steps, event properties, and saved segment/cohort recipes.
3. Advanced opt-ins: performance, revenue, server-side conversion tracking, and replays.
4. Client marketing operations: Links and Pixels playbooks.

If these changes are made in the monorepo source, run:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

## Guardrails

- Use `next/script`; do not drop a raw blocking script tag into the layout.
- Guard CSP interpolation so unset Umami env vars do not emit `undefined` into headers.
- Do not gate production tracking on `NODE_ENV` alone. Railway staging also runs with production-like environment values.
- Do not send PII in event data, session properties, or distinct IDs.
- Do not move Umami-specific code into `@techstream/quark-core` unless Quark later introduces a vendor-neutral analytics abstraction.
- Do not enable Replays without masking strategy, sampling, and an explicit privacy review.
- Do not use Umami Links for normal internal navigation inside the app.
- Do not add Pixels to pages that already load `umami.js`.