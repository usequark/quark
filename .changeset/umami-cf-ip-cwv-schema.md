---
"@usequark/quark-create-app": patch
---

Fix two analytics-correctness issues found by reading Umami v3.1.0 source against the scaffold: web-vitals beacons now post the send-schema custom event (`name: "cwv"` + `data`, incl. hostname) to `/s/api/send` — the old `event_name`/`event_data` payload to a nonexistent `/api/collect` endpoint was silently dropped upstream while recording nothing. The ingest proxy now prefers `CF-Connecting-IP` behind an explicit `TRUST_CF_CONNECTING_IP=true` opt-in (unconditional trust would let any client override XFF, which most proxies pass through unsanitized); forwarding falls back to the XFF chain by default and to `"unknown"` when `TRUST_PROXY_HEADERS=false`. Documents the `data-performance` twin-row display artifact.
