---
"@techstream/quark-create-app": minor
---

Add optional PWA support as a scaffolded package. When selected via `--packages pwa`, the scaffold generates a Next.js native manifest (`app/manifest.json`), a vanilla service worker (`public/sw.js`) with cache-first static assets and network-first navigation, and a client component for SW registration. Zero external dependencies — no Workbox, no next-pwa, no config file modifications.
