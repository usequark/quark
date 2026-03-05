---
"@techstream/quark-core": minor
"@techstream/quark-create-app": minor
---

## @techstream/quark-core

### Email — pluggable provider system

The email service has been refactored to use a **Strategy Pattern**. A new `EmailProvider` base class is now exported, along with a `registerEmailProvider()` function so applications can plug in any email provider.

Built-in providers:
- `smtp` — Nodemailer (unchanged behaviour)
- `resend` — Resend API (unchanged behaviour)
- `zeptomail` — **new** ZeptoMail provider (set `EMAIL_PROVIDER=zeptomail` + `ZEPTOMAIL_TOKEN`)

Custom providers can be registered at startup and used transparently:

```js
import { EmailProvider, registerEmailProvider } from "@techstream/quark-core";

class SendGridProvider extends EmailProvider {
  async sendEmail(to, subject, html, text) { … }
}
registerEmailProvider("sendgrid", SendGridProvider);
```

### Storage — pre-signed S3 upload URLs

`createS3Storage()` now exposes `getSignedUploadUrl(key, options?)` which generates a pre-signed `PUT` URL for direct client-to-S3/R2 uploads (no server proxy required). The local storage adapter exposes the same method and throws a helpful error pointing developers to the correct upload route.

```js
const { url, key, expiresAt } = await storage.getSignedUploadUrl("uploads/photo.jpg", {
  expiresIn: 300,       // seconds (default: 300)
  contentType: "image/jpeg",
});
```

## @techstream/quark-create-app

### New utility — `formatProjectDisplayName()`

A new `formatProjectDisplayName(name)` utility converts a kebab-case project slug to a human-readable title (e.g. `my-cool-app` → `My Cool App`). It is used internally during scaffolding and is exported for use in scripts.

### Scaffolded project improvements

- **`.env.example`** — improved structure and comments: copy-paste instructions at the top, ZeptoMail config block, database pool notes, and `WORKER_CONCURRENCY` variable documented.
- **`validate-env.js`** — new optional env vars recognised: `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`, `ZEPTOMAIL_BOUNCE_EMAIL`, `APP_DESCRIPTION`, `WORKER_CONCURRENCY`.
- **Health check** (`/api/health`) — now verifies storage connectivity in addition to database and Redis.
- **Admin package scaffolding** — `pnpm create quark-app` now includes the admin UI package scaffold.
- **`nano-staged` / `simple-git-hooks`** — updated linting hooks in the scaffolded template.
