# Quark API Documentation

## Overview

Quark provides a REST API for interacting with the platform. Authentication runs through two independent schemes, pick one per client:

- **Session cookie (web):** NextAuth.js issues a `next-auth.session-token` cookie after login. Server code reads it with `auth()`, and guarded routes call `requireAuth(session)` or `requireRole(role, session)` from `@/lib/auth-middleware`.
- **Bearer JWT (mobile):** `POST /api/auth/token`, `/api/auth/apple`, and `/api/auth/google` return an access token, a refresh token, and an expiry. Send the access token as `Authorization: Bearer <token>`.

State-changing routes are wrapped in `withCsrfProtection` and require a token from `GET /api/csrf` in the `x-csrf-token` header.

---

## Authentication

### `POST /api/auth/signin`

Sign in with credentials. Handled by NextAuth.js at `/api/auth/[...nextauth]`.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** Redirects to callback URL with session cookie.

GitHub and Google OAuth providers are registered automatically when `GITHUB_ID` and `GITHUB_SECRET`, or `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, are set. All five OAuth variables are optional; an app that sets none is unaffected.

Separately from NextAuth, `POST /api/auth/google` and `POST /api/auth/apple` are hand-written token-exchange endpoints used by the mobile app. They read `GOOGLE_CLIENT_ID` and `APPLE_CLIENT_ID` respectively. Both are declared and validated, but the endpoints do not yet gate on them — binding the token to this deployment is the next change.

### `GET /api/auth/session`

Get the current session. Session strategy is JWT.

**Response:**
```json
{
  "user": {
    "id": "clx1234567890abcdef",
    "email": "jsmith@example.com",
    "name": "J Smith",
    "image": null,
    "role": "admin"
  },
  "expires": "2025-12-26T00:00:00.000Z"
}
```

### `POST /api/auth/signout`

Sign out the current user.

**Response:** Redirects to home page.

### `POST /api/auth/register`

Create a user with a hashed password and enqueue a welcome email. Public, but returns `403` when self-service signup is disabled via `AUTH_ALLOW_SIGNUP=false`. Requires a CSRF token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "name": "string"
}
```

**Validation** (`userRegisterSchema`): valid email; password at least 8 characters with an uppercase letter, a lowercase letter, and a digit; name at least 2 characters.

**Response (201):** the created user, password omitted. Enqueuing the welcome email is fire-and-forget: if that fails the user is still created.

### `POST /api/auth/token`

Exchange email and password for a JWT pair. Used by the mobile app for Bearer-token auth.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresAt": "2026-02-16T12:00:00.000Z"
}
```

**Response (401):** invalid credentials.

### `POST /api/auth/refresh`

Exchange a refresh token for a fresh access token.

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Response (200):** `{ "token": "eyJhbGciOi..." }`. Only the access token is rotated; the refresh token is reusable until it expires.

**Response (401):** invalid or expired refresh token, or a token that is not of type `refresh`.

### `POST /api/auth/apple`

Verify an Apple identity token and issue a JWT pair. Public.

**Request Body:**
```json
{
  "identityToken": "string",
  "nonce": "string"
}
```

The `kid` from the token header selects Apple's public key, which is fetched live from `https://appleid.apple.com/auth/keys` and verified against issuer `https://appleid.apple.com`. A user matching the token's email is created on first sign-in.

**Response (200):** `{ "token": "...", "refreshToken": "...", "expiresAt": "..." }`.

**Response (400):** the verified token carries no email address.

### `POST /api/auth/google`

Verify a Google ID token and issue a JWT pair. Public.

**Request Body:**
```json
{
  "idToken": "string"
}
```

The ID token is verified against Google's `tokeninfo` endpoint. A user matching the token's email is created on first sign-in.

**Response (200):** `{ "token": "...", "refreshToken": "...", "expiresAt": "..." }`.

**Response (400):** the verified token carries no email address.

### `GET /api/csrf`

Generate a CSRF token. Returns `401` when there is no active session. The token is also written to an `httpOnly` cookie so the server can validate it later.

**Response:**
```json
{
  "csrfToken": "a1b2c3d4e5f6..."
}
```

### `POST /api/device/register`

Register a mobile device for push notifications. Requires a Bearer JWT.

**Request Body:**
```json
{
  "platform": "ios",
  "pushToken": "string",
  "deviceId": "string"
}
```

`platform` is `ios` or `android`. The record is upserted on `(userId, deviceId)`, so re-registering after a token rotation updates in place.

**Response (200):** `{ "success": true }`

---

## Users

All `/api/users` routes return `USER_SAFE_SELECT` fields only: `id`, `email`, `emailVerified`, `name`, `image`, `role`, `createdAt`, `updatedAt`. The `password` column is never selected.

### `GET /api/users`

List users. Admin only (`role: admin`). **Requires authentication, not CSRF.**

Accepts `page` (default 1) and `limit` (default 20, max 100).

**Response:**
```json
{
  "data": [{ "id": "clx1234567890abcdef", "email": "user@example.com" }],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### `POST /api/users`

Create a user. Admin only. Requires a CSRF token.

**Request Body:** `{ "email": "string", "name": "string", "image": "string" }`

**Response (201):** the created user. **Response (409):** email already exists.

### `GET /api/users/[id]`

Get one user. Admin only. **Response (404):** no such user.

### `PATCH /api/users/[id]`

Update a user. Admin only. Requires a CSRF token. Body matches `userUpdateSchema`: `email`, `name`, `image`, all optional.

### `DELETE /api/users/[id]`

Delete a user. Admin only. Requires a CSRF token.

**Response (200):** `{ "success": true }`

### `GET /api/users/me`

Get the authenticated user's profile. Authenticated by Bearer JWT, not by session cookie.

**Response:** the user record. **Response (404):** the token's subject no longer resolves to a user.

### `PATCH /api/users/me`

Update the authenticated user's own profile. Requires a Bearer JWT and a CSRF token. Body matches `userUpdateSchema`.

---

## Health & Metrics

### `GET /api/health`

Probe the database, Redis, storage, and queues concurrently, each under its own deadline, capped by an overall 5 second budget.

Always returns `200`. The verdict is in the body's `status` field (`ok` / `degraded`), not in the status code: this is the platform healthcheck, and a non-200 makes the orchestrator restart the container, which drops every warm connection and produces a fresh connection storm on the dependency that was already struggling. Exempt from rate limiting, so a probe can never be answered with a `429`. Error messages are generic in production and carry the underlying driver error elsewhere. No response contains a credential.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-16T12:00:00.000Z",
  "durationMs": 12,
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok", "latencyMs": 1.23 },
    "storage": { "status": "ok", "provider": "local" },
    "queues": { "email-queue": { "status": "ok", "waiting": 0 } }
  }
}
```

### `GET /api/metrics`

Return all registered application metrics in Prometheus exposition format: HTTP request counts, durations, in-flight requests, error counts, and queue depth.

---

## Database Models

The schema ships exactly seven models: `User`, `Account`, `Session`, `VerificationToken`, `Job`, `File`, and `AuditLog`. Domain models are yours to add, see `EXAMPLES.md`.

### User

| Field         | Type     | Description                                                    |
|---------------|----------|----------------------------------------------------------------|
| id            | String   | Unique identifier (CUID)                                       |
| email         | String   | User email (unique)                                            |
| emailVerified | DateTime? | OAuth email verification timestamp                             |
| name          | String?  | Optional display name                                          |
| password      | String?  | Password hash, null for OAuth-only accounts                    |
| image         | String?  | Avatar URL                                                     |
| role          | UserRole | `admin`, `lead_dev`, `client_admin`, `editor`, `viewer` (default `viewer`) |
| accounts      | Account[] | Linked OAuth accounts                                         |
| sessions      | Session[] | Auth.js sessions                                              |
| auditLogs     | AuditLog[] | Audit entries written by this user                           |
| files         | File[]   | Files uploaded by this user                                    |
| createdAt     | DateTime | Creation timestamp                                             |
| updatedAt     | DateTime | Last update timestamp                                          |

### File

| Field           | Type     | Description                          |
|-----------------|----------|--------------------------------------|
| id              | String   | Unique identifier (CUID)            |
| filename        | String   | Sanitized storage filename           |
| originalName    | String   | Original upload filename             |
| mimeType        | String   | MIME type (e.g. `image/png`)         |
| size            | Int      | File size in bytes                   |
| storageKey      | String   | Unique key in storage provider       |
| storageProvider | String   | `"local"` or `"s3"` (default: local) |
| uploadedById    | String?  | Uploader's user ID (nullable)        |
| uploadedBy      | User?    | Uploader relation                    |
| createdAt       | DateTime | Creation timestamp                   |
| updatedAt       | DateTime | Last update timestamp                |

---

## File Upload API

### `POST /api/files`

Upload one or more files via `multipart/form-data`. Requires authentication.

**Request:** `Content-Type: multipart/form-data` with file field(s).

**Validation:**
- Max file size: 10 MB (env: `UPLOAD_MAX_SIZE`)
- Allowed types: images + PDF by default (env: `UPLOAD_ALLOWED_TYPES`)
- Magic-byte verification prevents MIME spoofing

**Response (single file - 201):**
```json
{
  "id": "clxyz...",
  "originalName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 245760,
  "url": "/api/files/clxyz...",
  "createdAt": "2026-02-16T12:00:00.000Z"
}
```

**Response (multiple files - 200):**
```json
{
  "files": [{ "id": "...", "originalName": "...", ... }]
}
```

### `GET /api/files`

List files uploaded by the current user. Requires authentication.

**Query Parameters:**
| Param | Type | Default | Description                |
|-------|------|---------|----------------------------|
| page  | int  | 1       | Page number                |
| limit | int  | 20      | Items per page, maximum 100 |

### `GET /api/files/[id]`

Download/serve a file by database ID or storage key. No authentication required (access by knowledge of the identifier). Images are served inline; other types as attachment downloads. Responses include a bounded `Cache-Control: public, max-age=3600`, because the URL carries no version segment and `immutable` would be a promise the route cannot keep.

### `DELETE /api/files/[id]`

Delete a file. Requires authentication + CSRF token. Only the uploader or an admin can delete.

---

## Job Queues

Queue names and job names come from the scaffolded `jobs` package, imported as `@<scope>/jobs`.

```js
import { JOB_NAMES, JOB_QUEUES } from "@<scope>/jobs";

JOB_QUEUES.EMAIL   // "email-queue"
JOB_QUEUES.FILES   // "files-queue"
JOB_QUEUES.PUSH    // "push-queue"
JOB_QUEUES.DEFAULT // "default-queue"

JOB_NAMES.SEND_WELCOME_EMAIL        // "send-welcome-email"
JOB_NAMES.SEND_RESET_PASSWORD_EMAIL // "send-reset-password-email"
JOB_NAMES.CLEANUP_ORPHANED_FILES    // "cleanup-orphaned-files"
JOB_NAMES.SEND_PUSH_NOTIFICATION    // "send-push-notification"
```

The worker registers a BullMQ worker for every queue in `JOB_QUEUES`.

### Email Queue

Queue name: `email-queue`

#### Jobs

**SEND_WELCOME_EMAIL**

Sends a welcome email to a new user. Enqueued automatically on registration.

```js
await queue.add(JOB_NAMES.SEND_WELCOME_EMAIL, { userId: "cuid123" });
```

**SEND_RESET_PASSWORD_EMAIL**

Sends a password reset email. The worker handler rejects the job unless both `userId` and `resetUrl` are present. No scaffolded route enqueues it, so your app calls it.

```js
await queue.add(JOB_NAMES.SEND_RESET_PASSWORD_EMAIL, {
  userId: "cuid123",
  resetUrl: "https://app.example.com/reset?token=abc",
});
```

### Files Queue

Queue name: `files-queue`

#### Jobs

**CLEANUP_ORPHANED_FILES**

Deletes files with no owner older than a retention period. The worker schedules it every 24 hours with `upsertJobScheduler`, which is atomic and so does not duplicate schedulers across restarts.

```js
await queue.add(JOB_NAMES.CLEANUP_ORPHANED_FILES, { retentionHours: 24 });
```

### Push Queue

Queue name: `push-queue`

#### Jobs

**SEND_PUSH_NOTIFICATION**

Delivers a push notification to a device registered through `POST /api/device/register`.

```js
await queue.add(JOB_NAMES.SEND_PUSH_NOTIFICATION, {
  deviceId: "device123",
  title: "New message",
  body: "You have a new message",
});
```

### Default Queue

Queue name: `default-queue`. No scaffolded handler is registered, so add one under `apps/worker/src/handlers/` and map it in `handlers/index.js` before enqueuing to it.

---

## Packages

Two packages are published to npm: `@usequark/quark-core` and `@usequark/quark-create-app`. Everything else (`db`, `config`, `ui`, `jobs`) is scaffolded as source into your project and imported under your own scope: `@<scope>/db`, `@<scope>/config`, `@<scope>/ui`, `@<scope>/jobs`. You own that code and edit it.

### `@<scope>/db`

Database client, Zod schemas, and query helpers. Scaffolded from `packages/db`.

```js
import { prisma, user, file } from "@<scope>/db";

// Find user by ID (safe select, password excluded)
const foundUser = await user.findById("cuid123");

// Find user by email. Returns ALL fields including the password hash.
// Internal auth only, never send the result to a client.
const userByEmail = await user.findByEmail("test@example.com");

// Create user (safe select)
const newUser = await user.create({ email: "new@example.com", name: "New User" });

// File queries
const myFiles = await file.findByUploader("cuid123");
const record = await file.findById("fileid");
const orphaned = await file.findOlderThan(new Date("2026-01-01"));
```

Query helpers are exported for `user`, `job`, `account`, `session`, `verificationToken`, `auditLog`, and `file`. Validation schemas (`userCreateSchema`, `userRegisterSchema`, `userUpdateSchema`, `fileUploadSchema`) come from the same package.

### `@usequark/quark-core`

Core infrastructure utilities. Published to npm, so the import is unscoped.

```js
import {
  // Storage
  createStorage,
  createLocalStorage,
  createS3Storage,
  generateStorageKey,
  getAssetUrl,
  // File validation
  validateFile,
  detectMimeType,
  isTypeAllowed,
  // Multipart parsing
  parseMultipart,
  // Pagination
  parsePaginationQuery,
  // Auth, queue, logging, etc.
  createAuthConfig,
  createQueue,
  createWorker,
  createLogger,
} from "@usequark/quark-core";
import { AppError, ValidationError } from "@usequark/quark-core/errors";

// Storage - reads STORAGE_PROVIDER env var
// For STORAGE_PROVIDER=s3, install @aws-sdk/client-s3 and
// @aws-sdk/s3-request-presigner in the app first.
const storage = createStorage();
const key = generateStorageKey("photo.jpg"); // "uploads/2026/02/<id>-photo.jpg"
await storage.put(key, buffer, { contentType: "image/jpeg" });
const { body, contentType } = await storage.get(key);
await storage.delete(key);

// File validation - magic-byte detection + MIME allow-list
const result = validateFile({
  filename: "photo.jpg",
  mimeType: "image/jpeg",
  size: 245760,
  buffer: fileBuffer,
});
// result: { valid: true, detectedType: "image/jpeg" }

// Multipart parsing - streams Web Request bodies into files + fields
const { files, fields } = await parseMultipart(request);

// Logging - console output is reserved for bootstrap, CLI, and test code
const logger = createLogger("my-feature");
logger.info("did the thing");
```

`getAssetUrl(key)` returns a URL rooted at `ASSET_CDN_URL` when a CDN is configured, and falls back to the local `/api/files/<key>` route otherwise.

Subpath entry points exist for narrower imports: `@usequark/quark-core/errors`, `/auth`, `/db`, `/email`, `/health`, `/locale`, `/logger`, `/metrics`, `/queue`, `/sms`, `/storage`, `/storage/s3`, `/stripe`, `/testing`.

### `@<scope>/ui`

Shared Tailwind UI primitives. Scaffolded from `packages/ui`, so you own the components and edit them freely.

```jsx
import { Button } from "@<scope>/ui";

// Primary button (default)
<Button>Click me</Button>

// Secondary button
<Button variant="secondary">Cancel</Button>

// With additional props
<Button disabled onClick={() => {}}>Submit</Button>
```

`packages/ui/src/index.js` is the authoritative export list: `badge`, `button`, `card`, `checkbox`, `container`, `dialog`, `error-banner`, `footer`, `form-field`, `input`, `label`, `lightbox`, `logo`, `navbar`, `password-input`, `rich-text`, `select`, `skeleton`, `spinner`, `table`, `textarea`, `theme`, `theme-constants`, `toast`. Never deep-import: `@<scope>/ui/components/button` is not a public path.

### `@<scope>/config`

Environment validation and config loading. Scaffolded from `packages/config`.

```js
import { config } from "@<scope>/config";

config.appName; // "Quark" unless APP_NAME is set
```

### `@<scope>/jobs`

Job queue and job name constants. Scaffolded from `packages/jobs`. See [Job Queues](#job-queues).

```js
import { JOB_NAMES, JOB_QUEUES } from "@<scope>/jobs";
```

---

## Environment Variables

| Variable             | Description                                            | Example                                    |
|----------------------|--------------------------------------------------------|--------------------------------------------|
| DATABASE_URL         | PostgreSQL connection string                           | `postgresql://user:pass@localhost:5432/db` |
| REDIS_URL            | Redis connection string                                | `redis://localhost:6379`                   |
| NEXTAUTH_SECRET      | NextAuth.js secret key (min 32 chars)                  | `openssl rand -base64 32`                  |
| PORT                 | Web app port                                           | `3000`                                     |
| APP_URL              | Application URL (auto-derived in dev)                  | `https://yourdomain.com`                   |
| WORKER_CONCURRENCY   | Worker job concurrency                                 | `5`                                        |
| AUTH_ALLOW_SIGNUP    | Set to `false` to disable public self-service signup   | `false`                                    |
| **Email**            |                                                        |                                            |
| EMAIL_PROVIDER       | `"smtp"` (default), `"resend"`, `"zeptomail"`, or custom | `zeptomail`                              |
| EMAIL_FROM           | Sender address                                         | `App <noreply@yourdomain.com>`             |
| MAIL_HOST            | Dev SMTP host (Mailpit)                                | `localhost`                                |
| MAIL_SMTP_PORT       | Dev SMTP port (Mailpit)                                | `1025`                                     |
| SMTP_HOST            | Production SMTP relay host                             | `smtp.example.com`                         |
| SMTP_PORT            | Production SMTP relay port                             | `587`                                      |
| SMTP_USER            | Production SMTP username                               | -                                          |
| SMTP_PASSWORD        | Production SMTP password                               | -                                          |
| SMTP_SECURE          | Use TLS for SMTP                                       | `true`                                     |
| RESEND_API_KEY       | Resend API key (when `EMAIL_PROVIDER=resend`)           | `re_xxxxxxxxxxxxx`                         |
| ZEPTOMAIL_TOKEN      | Zeptomail API token (when `EMAIL_PROVIDER=zeptomail`)  | -                                          |
| ZEPTOMAIL_URL        | Zeptomail API base URL                                 | `https://api.zeptomail.com`                |
| ZEPTOMAIL_BOUNCE_EMAIL | Bounce address for Zeptomail                         | `bounce@yourdomain.com`                    |
| **Storage**          |                                                        |                                            |
| STORAGE_PROVIDER     | `"local"` (default) or `"s3"`                          | `local`                                    |
| STORAGE_LOCAL_DIR    | Local storage directory                                | `./uploads`                                |
| S3_BUCKET            | S3/R2 bucket name                                      | `my-app-uploads`                           |
| S3_REGION            | S3 region (`"auto"` for Cloudflare R2)                 | `auto`                                     |
| S3_ENDPOINT          | Custom S3 endpoint (required for R2)                   | `https://<id>.r2.cloudflarestorage.com`    |
| S3_ACCESS_KEY_ID     | S3 access key                                          | -                                          |
| S3_SECRET_ACCESS_KEY | S3 secret key                                          | -                                          |
| S3_PUBLIC_URL        | Public bucket URL prefix                               | `https://cdn.example.com`                  |
| ASSET_CDN_URL        | Provider-agnostic CDN base URL, falls back to `/api/files` | `https://cdn.example.com`               |
| **Upload Limits**    |                                                        |                                            |
| UPLOAD_MAX_SIZE      | Max file size in bytes (default: 10 MB)                | `10485760`                                 |
| UPLOAD_ALLOWED_TYPES | Comma-separated MIME types                             | `image/jpeg,image/png,application/pdf`     |

There is no `r2` value for `STORAGE_PROVIDER`. Cloudflare R2 and MinIO are reached through `STORAGE_PROVIDER=s3` plus `S3_ENDPOINT`, and credentials are always the `S3_*` pair, never `AWS_*`.
