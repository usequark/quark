---
"@techstream/quark-create-app": patch
---

Fix 5 env/auth bugs in scaffolded and monorepo apps

- `next.config.js` now falls back to `http://localhost:${PORT}` for `NEXTAUTH_URL`, so the client-side Auth.js base URL matches the dev port instead of hardcoded `localhost:3000`
- Rate-limit keying uses a new `getClientIp()` helper (`x-forwarded-for` → `x-real-ip` → `unknown`) instead of the removed `NextRequest.ip`, which had collapsed every client into one shared bucket
- `getAllowedOrigins()` derives dev origins from `process.env.PORT` (with `127.0.0.1` and next-dev host extras) instead of the hard-coded config default, and no longer concatenates ports as strings
- `validateEnv()` now warns when `APP_URL` is missing in production/staging, where Auth.js and CORS silently fall back to `http://localhost`
- Scaffolded `.env.example` gets an accurate APP_URL comment, a ≥32-character `NEXTAUTH_SECRET` placeholder (the old one failed startup validation), and a path-free `NEXTAUTH_URL` comment
