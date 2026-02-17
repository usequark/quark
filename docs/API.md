# Quark API Documentation

## Overview

Quark provides a REST API for interacting with the platform. Authentication is handled via NextAuth.js.

---

## Authentication

### `POST /api/auth/signin`

Sign in with credentials.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** Redirects to callback URL with session cookie.

### `GET /api/auth/session`

Get the current session.

**Response:**
```json
{
  "user": {
    "name": "J Smith",
    "email": "jsmith@example.com"
  },
  "expires": "2025-12-26T00:00:00.000Z"
}
```

### `POST /api/auth/signout`

Sign out the current user.

**Response:** Redirects to home page.

---

## Database Models

### User

| Field     | Type     | Description              |
|-----------|----------|--------------------------|
| id        | String   | Unique identifier (CUID) |
| email     | String   | User email (unique)      |
| name      | String?  | Optional display name    |
| createdAt | DateTime | Creation timestamp       |
| updatedAt | DateTime | Last update timestamp    |
| posts     | Post[]   | User's posts             |

### Post

| Field     | Type     | Description              |
|-----------|----------|--------------------------|
| id        | String   | Unique identifier (CUID) |
| title     | String   | Post title               |
| content   | String?  | Post content             |
| published | Boolean  | Publication status       |
| authorId  | String   | Author's user ID         |
| author    | User     | Author relation          |
| createdAt | DateTime | Creation timestamp       |
| updatedAt | DateTime | Last update timestamp    |

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

**Response (single file — 201):**
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

**Response (multiple files — 200):**
```json
{
  "files": [{ "id": "...", "originalName": "...", ... }]
}
```

### `GET /api/files`

List files uploaded by the current user. Requires authentication.

**Query Parameters:**
| Param | Type | Default | Description     |
|-------|------|---------|-----------------|
| page  | int  | 1       | Page number     |
| limit | int  | 50      | Items per page  |

### `GET /api/files/[id]`

Download/serve a file by ID. No authentication required (access by knowledge of ID). Images are served inline; other types as attachment downloads. Responses include `Cache-Control: immutable`.

### `DELETE /api/files/[id]`

Delete a file. Requires authentication + CSRF token. Only the uploader or an admin can delete.

---

## Job Queues

### Email Queue

Queue name: `email-queue`

#### Jobs

**SEND_WELCOME_EMAIL**

Sends a welcome email to a new user. Enqueued automatically on registration.

```js
await queue.add("send-welcome-email", { userId: "cuid123" });
```

**SEND_RESET_PASSWORD_EMAIL**

Sends a password reset email.

```js
await queue.add("send-reset-password-email", {
  userId: "cuid123",
  resetUrl: "https://app.example.com/reset?token=abc",
});
```

### Files Queue

Queue name: `files-queue`

#### Jobs

**CLEANUP_ORPHANED_FILES**

Deletes files with no owner older than a retention period. Runs automatically every 24 hours as a repeating job.

```js
await queue.add("cleanup-orphaned-files", { retentionHours: 24 });
```

---

## Packages

### @techstream/quark-db

Database client and query helpers.

```js
import { prisma, user, file } from "@techstream/quark-db";

// Find user by ID
const foundUser = await user.findById("cuid123");

// Find user by email
const userByEmail = await user.findByEmail("test@example.com");

// Create user
const newUser = await user.create({ email: "new@example.com", name: "New User" });

// File queries
const myFiles = await file.findByUploader("cuid123");
const record = await file.findById("fileid");
const orphaned = await file.findOlderThan(new Date("2026-01-01"));
```

### @techstream/quark-core

Core infrastructure utilities.

```js
import {
  // Storage
  createStorage,
  createLocalStorage,
  createS3Storage,
  generateStorageKey,
  // File validation
  validateFile,
  detectMimeType,
  isTypeAllowed,
  // Multipart parsing
  parseMultipart,
  // Auth, queue, errors, etc.
  createAuthConfig,
  createQueue,
  createWorker,
  AppError,
  ValidationError,
} from "@techstream/quark-core";

// Storage — reads STORAGE_PROVIDER env var
const storage = createStorage();
const key = generateStorageKey("photo.jpg"); // "uploads/2026/02/abc123-photo.jpg"
await storage.put(key, buffer, { contentType: "image/jpeg" });
const { body, contentType } = await storage.get(key);
await storage.delete(key);

// File validation — magic-byte detection + MIME allow-list
const result = validateFile({
  filename: "photo.jpg",
  mimeType: "image/jpeg",
  size: 245760,
  buffer: fileBuffer,
});
// result: { valid: true, detectedType: "image/jpeg" }

// Multipart parsing — streams from Web Request into files + fields
const { files, fields } = await parseMultipart(request);
```

### @techstream/quark-ui

Shared UI components.

```tsx
import { Button } from "@techstream/quark-ui";

// Primary button (default)
<Button>Click me</Button>

// Secondary button
<Button variant="secondary">Cancel</Button>

// With additional props
<Button disabled onClick={() => {}}>Submit</Button>
```

### @techstream/quark-jobs

Job queue definitions.

```js
import { JOB_QUEUES, JOB_NAMES } from "@techstream/quark-jobs";

// Queue names
JOB_QUEUES.EMAIL  // "email-queue"
JOB_QUEUES.FILES  // "files-queue"

// Job names
JOB_NAMES.SEND_WELCOME_EMAIL        // "send-welcome-email"
JOB_NAMES.SEND_RESET_PASSWORD_EMAIL  // "send-reset-password-email"
JOB_NAMES.CLEANUP_ORPHANED_FILES     // "cleanup-orphaned-files"
```

### @techstream/quark-config

Shared configuration.

```typescript
import { config } from "@techstream/quark-config";

config.appName // "Quark"
```

---

## Environment Variables

| Variable             | Description                             | Example                                   |
|----------------------|-----------------------------------------|-------------------------------------------|
| DATABASE_URL         | PostgreSQL connection string            | `postgresql://user:pass@localhost:5432/db` |
| REDIS_URL            | Redis connection string                 | `redis://localhost:6379`                   |
| NEXTAUTH_SECRET      | NextAuth.js secret key                  | `openssl rand -base64 32`                 |
| MAIL_SMTP_URL        | SMTP server URL                         | `smtp://localhost:1025`                    |
| PORT                 | Web app port                            | `3000`                                     |
| APP_URL              | Application URL (auto-derived in dev)   | `https://yourdomain.com`                  |
| WORKER_CONCURRENCY   | Worker job concurrency                  | `5`                                        |
| **Storage**          |                                         |                                           |
| STORAGE_PROVIDER     | `"local"` (default) or `"s3"`           | `local`                                    |
| STORAGE_LOCAL_DIR    | Local storage directory                 | `./uploads`                                |
| S3_BUCKET            | S3/R2 bucket name                       | `my-app-uploads`                           |
| S3_REGION            | S3 region (`"auto"` for Cloudflare R2)  | `auto`                                     |
| S3_ENDPOINT          | Custom S3 endpoint (required for R2)    | `https://<id>.r2.cloudflarestorage.com`    |
| S3_ACCESS_KEY_ID     | S3 access key                           | —                                          |
| S3_SECRET_ACCESS_KEY | S3 secret key                           | —                                          |
| S3_PUBLIC_URL        | Optional CDN URL for public file access | `https://cdn.example.com`                  |
| **Upload Limits**    |                                         |                                           |
| UPLOAD_MAX_SIZE      | Max file size in bytes (default: 10 MB) | `10485760`                                 |
| UPLOAD_ALLOWED_TYPES | Comma-separated MIME types              | `image/jpeg,image/png,application/pdf`     |
