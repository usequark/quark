---
"@usequark/quark-create-app": minor
---

Add `TRUST_PROXY_HEADERS` to control whether the rate limiter trusts client-supplied proxy headers.

The scaffolded `apps/web/src/proxy.js` keyed rate-limit buckets on the left-most `x-forwarded-for` entry (falling back to `x-real-ip`) unconditionally, so a client that could reach the app directly could rotate a spoofed header and earn a fresh bucket per request.

`TRUST_PROXY_HEADERS` now gates that trust. **Default (unset) preserves today's behaviour** — the headers are trusted, which is correct behind a reverse proxy (Railway, Docker, nginx) that overwrites them. Set `TRUST_PROXY_HEADERS=false` when the app is exposed directly; the headers are then ignored and every client keys on the literal `"unknown"`. Buckets are keyed on `<client-ip>:<path>`, so that is one bucket shared by every client *of each route* — a spoofed header cannot evade the limiter that way, but one client's burst can exhaust the bucket for the route it floods. Only explicit false-like values (`false`, `0`, `no`, `off`) disable trust; anything else keeps the default.

**Migration:** none required. Leave the variable unset behind a proxy. Only set `TRUST_PROXY_HEADERS=false` if the app is reachable without a proxy rewriting the headers — note that collapses each route's clients onto a shared `unknown:<path>` bucket, so a single client can lock out one path (e.g. `POST /api/auth/callback/credentials`) for everyone during the window; other routes keep their own buckets. See `docs/SECURITY_FEATURES.md` ("Rate-Limit Keying & Proxy Headers") and `apps/web/.env.example`.
