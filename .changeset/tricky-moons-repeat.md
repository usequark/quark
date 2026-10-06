---
"@usequark/quark-core": patch
---

Fix `getAssetUrl()` producing URLs the app cannot serve, and drop `immutable`
from the file route.

**`getAssetUrl()`'s fallback was broken.** It returns
`/api/files/<key>` built from a storage key, but the scaffolded
`GET /api/files/[id]` route looked its path segment up by database id only:

```js
const record = await file.findById(id);   // findById("uploads/2026/02/abc.jpg")
```

so every URL the function produced was a 404. The route now accepts a storage
key as well as an id. The two forms are disjoint — a cuid never contains `/`, a
generated key always does — so the id path costs no extra query.

`getAssetUrl()`'s signature and return value are unchanged, so this is not a
breaking change for scaffolded projects: nothing they call needs to move.

**The CDN branch was not broken.** `ASSET_CDN_URL + key` is the correct shape
for a CDN rooted at the bucket, which is the standard arrangement and needs no
rewrite rules. The docstring now says so explicitly and points at
`S3_PUBLIC_URL` / the S3 adapter's `getPublicUrl()` for a CDN that is *not*
bucket-rooted, rather than leaving the requirement implied.

**`immutable` removed from the file route.** The route served
`Cache-Control: public, max-age=31536000, immutable`, but `/api/files/${id}`
carries no version segment and nothing in the path is content-addressed.
`immutable` tells caches never to revalidate for a year, so any path that
reuses an identifier — admin tooling, a seed, a restore from backup — leaves
every browser and CDN holding the old bytes indefinitely. Now
`public, max-age=3600`, which bounds that window. Versioning the URL instead
would be the stronger fix but changes the public URL contract for every
scaffolded project; a bounded `max-age` was taken as the proportionate change.