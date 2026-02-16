# @techstream/quark-core

## 2.0.0

### Major Changes

- [`0817b68`](https://github.com/Bobnoddle/quark/commit/0817b6841f29e5b3144a9475a592b7fc93b6c4e1) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - refactor: replace Mailhog-specific configuration with generic mail service support

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

## 1.5.0

### Minor Changes

- [`590592d`](https://github.com/Bobnoddle/quark/commit/590592d87c8dc796fc8025643997b0b0d31cceef) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: add file upload, validation, and storage system

  - Add file validation module with MIME type checking, size limits, and malicious content detection
  - Add multipart form data parsing utilities
  - Add pluggable storage adapters (local filesystem and S3-compatible)
  - Add File model to Prisma schema with associated queries and Zod schemas
  - Add file processing job definition
  - Add file upload/download API routes to the web app
  - Add email and file processing handlers to the worker
  - Update CLI templates to include file upload infrastructure

## 1.4.0

### Minor Changes

- [`17656c6`](https://github.com/Bobnoddle/quark/commit/17656c684cd826d8026573b44ae271c197a9110b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add automated release pipeline with Changesets
