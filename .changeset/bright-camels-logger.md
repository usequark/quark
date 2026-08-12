---
"@techstream/quark-core": patch
---

Add a browser-safe `./logger` subpath export. The main barrel re-exports node-only modules (redis, queue, email) that Turbopack cannot bundle into client components; `@techstream/quark-core/logger` exposes only the zero-dependency logger so client-side code can use `createLogger()` without pulling the server-only graph.
