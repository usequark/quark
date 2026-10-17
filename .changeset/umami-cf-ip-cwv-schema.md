---
"@usequark/quark-create-app": patch
---

Fix two analytics-correctness issues found by reading Umami v3.1.0 source against the scaffold: web-vitals beacons now post the send-schema custom event (`name: "cwv"` + `data`, incl. hostname) to `/s/api/send` — the old `event_name`/`event_data` payload to a nonexistent `/api/collect` endpoint was silently dropped upstream while recording nothing. The ingest proxy now prefers `CF-Connecting-IP` and forwards a single stable IP (Railway replaces `X-Forwarded-For` with the edge address, misattributing geo and splitting Umami's `hash(IP, UA, site)` session identity); both drop to `"unknown"` when `TRUST_PROXY_HEADERS=false`. Documents the `data-performance` twin-row display artifact.
