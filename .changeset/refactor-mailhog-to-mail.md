---
"@techstream/quark-core": major
---

refactor: replace Mailhog-specific configuration with generic mail service support

**BREAKING CHANGES:**

- Renamed `getMailhogSmtpConfig()` to `getMailSmtpConfig()`
- Renamed `getMailhogSmtpUrl()` to `getMailSmtpUrl()`
- Renamed `getMailhogUiUrl()` to `getMailUiUrl()`
- Renamed environment variables:
  - `MAILHOG_SMTP_URL` → `MAIL_SMTP_URL`
  - `MAILHOG_HOST` → `MAIL_HOST`
  - `MAILHOG_SMTP_PORT` → `MAIL_SMTP_PORT`
  - `MAILHOG_UI_PORT` → `MAIL_UI_PORT`
- Deleted `packages/core/src/mailhog.js` module
- Added `packages/core/src/mail.js` with provider-agnostic API

This change makes the mail service configuration generic and compatible with multiple SMTP providers (Mailpit, Mailhog, etc.) instead of being Mailhog-specific.
