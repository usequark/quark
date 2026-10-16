---
"@usequark/quark-create-app": patch
---

Scaffold Umami analytics behind a first-party proxy: the tracker loads from `/s/script.js` with `data-host-url="/s"` and beacons/replay POST same-origin to `/s/api/send`, `/s/api/collect`, and `/s/api/record`, so blocklists never see the upstream host and CSP stays `'self'`-only. Adds the ingest Route Handler (endpoint whitelist, POST-only, credential strip, geo header forwarding, `no-store`, fail-open 202), a client/server config split keeping the upstream host out of browser bundles, and an optional server-only `UMAMI_UPSTREAM_URL`/`UMAMI_URL` override.
