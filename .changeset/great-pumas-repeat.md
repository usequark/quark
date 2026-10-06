---
"@usequark/quark-create-app": patch
---

Make `GET /api/files/[id]` resolve a storage key, and stop promising the bytes
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