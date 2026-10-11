---
"@usequark/quark-create-app": patch
---

Fix stored XSS: SVG files are no longer served inline from /api/files/[id].

An SVG is an XML document that can carry `<script>`. The file-serving route
treated every `image/*` as inline-displayable, and the app's CSP
(`default-src 'self'`) permits those scripts to run — so any uploaded SVG
executed in the application's own origin on a public, unauthenticated
endpoint. Upload was always the easy part; the bug was in how the bytes
came back out.

The route now:

- serves only raster formats (`jpeg`, `png`, `gif`, `webp`, `avif`) inline;
  SVG downloads as an `attachment`
- adds `Content-Security-Policy: default-src 'none'; style-src
  'unsafe-inline'; sandbox` on SVG responses as a second lock, for browsers
  that ignore or mishandle the disposition header

Raster image rendering is unchanged. Two regression tests pin both
directions: SVG must never be inline and must carry the sandbox CSP; a PNG
must still be inline and must not carry it.
