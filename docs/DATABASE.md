# Database Schema Documentation

> Quark uses **PostgreSQL 16** with **Prisma 7** as the ORM.
> Schema: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma)
> Query helpers: [`packages/db/src/queries.js`](../packages/db/src/queries.js)

---

## Database Seeding

Seeding is driven by `packages/db/prisma/seed.js` via `pnpm db:seed`. Two profiles are available, selected by `SEED_PROFILE`.

| `SEED_PROFILE` | Created records | When to use |
|---|---|---|
| `minimal` | Admin user only (`admin@example.com`) | Production: first deploy only |
| `dev` *(default)* | Admin + sample viewer + audit log + sample job | Staging, local dev, E2E tests |

Both profiles are **idempotent** - re-running when data already exists is safe and exits cleanly.

### Commands

```bash
# Production (first deploy only)
SEED_PROFILE=minimal pnpm --filter @usequark/quark-db db:seed

# Staging / local dev
pnpm --filter @usequark/quark-db db:seed

# Wipe staging + reseed from scratch
pnpm --filter @usequark/quark-db exec prisma migrate reset --force
# migrate reset automatically calls db:seed at the end
```

### Why SEED_PROFILE, not NODE_ENV

`SEED_PROFILE` is intentionally separate from `NODE_ENV`. Railway sets `NODE_ENV=production` on **all** deployed services - including staging - for Next.js build/performance reasons. Deriving the seed profile from `NODE_ENV` would silently give staging the minimal seed instead of the full dev dataset.

This project does support `NODE_ENV=staging` via `resolveEnvironment()` in `packages/config/src/environment.js`, but that only works if Railway is explicitly configured with that value - an error-prone manual step. `SEED_PROFILE` makes intent explicit and visible in deploy commands and CI logs.

### Seed credentials (dev data only)

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `admin123` | admin |
| `user@example.com` | *(OAuth only - no password set)* | viewer |

> These are scaffolded placeholder credentials. Change `admin@example.com`'s password immediately after first login on any deployed environment.

---

## Overview

| Models | Enums | Relations | Indexes |
|--------|-------|-----------|---------|
| 7 | 1 | 4 | 20 |

```
User ─┬── Account    (1:many, cascade delete)
      ├── Session    (1:many, cascade delete)
      ├── AuditLog   (1:many, cascade delete)
      └── File       (1:many, set null on delete)

Job           (standalone - BullMQ audit trail)
VerificationToken (standalone - NextAuth email verification)
```

---

## Models

### User

The central identity model. Used by NextAuth for authentication and by the application for authorization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PK, CUID | Unique identifier |
| `email` | `String` | Unique | Login email |
| `emailVerified` | `DateTime?` | - | Set when email is confirmed |
| `name` | `String?` | - | Display name |
| `password` | `String?` | - | Bcrypt hash (12 rounds). Null for OAuth-only users |
| `image` | `String?` | - | Avatar URL |
| `role` | `String` | Default: `"viewer"` | RBAC role (`admin`, `editor`, `viewer`). The `admin` role is an auth concept (highest privilege level) — unrelated to the removed `@usequark/quark-admin` package. |
| `createdAt` | `DateTime` | Default: `now()` | - |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

**Indexes:** `email`, `createdAt`

**Security:** The `password` field is **never** returned to clients. All query helpers use `USER_SAFE_SELECT` which explicitly excludes it. Only `user.findByEmail()` returns the full record (for internal auth use only).

**Relations:**
- `accounts` → `Account[]` (OAuth providers)
- `sessions` → `Session[]`
- `auditLogs` → `AuditLog[]`
- `files` → `File[]`

---

### Account (NextAuth)

OAuth provider accounts linked to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PK, CUID | - |
| `userId` | `String` | FK → User | - |
| `type` | `String` | - | Account type (e.g. `"oauth"`) |
| `provider` | `String` | - | Provider name (e.g. `"github"`, `"google"`) |
| `providerAccountId` | `String` | - | External account ID |
| `refresh_token` | `String?` | `@db.Text` | OAuth refresh token |
| `access_token` | `String?` | `@db.Text` | OAuth access token |
| `expires_at` | `Int?` | - | Token expiry (epoch seconds) |
| `token_type` | `String?` | - | e.g. `"bearer"` |
| `scope` | `String?` | - | OAuth scopes granted |
| `id_token` | `String?` | `@db.Text` | OIDC ID token |
| `session_state` | `String?` | - | Provider session state |
| `createdAt` | `DateTime` | Default: `now()` | - |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

**Unique:** `(provider, providerAccountId)` - one account per provider per external ID.

**Indexes:** `userId`

**Cascade:** Deleting a user deletes all linked accounts.

---

### Session (NextAuth)

Active user sessions for database-backed session strategy.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PK, CUID | - |
| `sessionToken` | `String` | Unique | The session cookie value |
| `userId` | `String` | FK → User | - |
| `expires` | `DateTime` | - | Session expiry |
| `createdAt` | `DateTime` | Default: `now()` | - |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

**Indexes:** `userId`, `expires`

**Performance note:** The `expires` index enables efficient cleanup of expired sessions.

---

### VerificationToken (NextAuth)

Email verification and magic-link tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `identifier` | `String` | - | Usually the user's email |
| `token` | `String` | Unique | The verification token value |
| `expires` | `DateTime` | - | Token expiry |
| `createdAt` | `DateTime` | Default: `now()` | - |

**Unique:** `(identifier, token)`

**Indexes:** `token`, `expires`

**Note:** No `id` primary key - uses the composite `(identifier, token)` unique constraint. The `expires` index supports efficient cleanup via `verificationToken.deleteExpired()`.

---

### Job

Database-side audit trail for background jobs. **Not actively used by the BullMQ worker** - job lifecycle is managed entirely in Redis. This model exists for optional reporting/auditing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PK, CUID | - |
| `queue` | `String` | - | Queue name (e.g. `"default"`) |
| `name` | `String` | - | Job type (e.g. `"SEND_WELCOME_EMAIL"`) |
| `data` | `Json?` | - | Job payload |
| `status` | `JobStatus` | Default: `PENDING` | Current state |
| `error` | `String?` | - | Error message on failure |
| `attempts` | `Int` | Default: `0` | Number of attempts made |
| `maxRetries` | `Int` | Default: `3` | Maximum retry count |
| `runAt` | `DateTime` | Default: `now()` | Scheduled execution time |
| `startedAt` | `DateTime?` | - | When processing began |
| `completedAt` | `DateTime?` | - | When processing finished |
| `createdAt` | `DateTime` | Default: `now()` | - |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

**Indexes:** `queue`, `status`, `runAt`, `(status, runAt)` (compound), `createdAt`

**Enum `JobStatus`:** `PENDING` | `IN_PROGRESS` | `COMPLETED` | `FAILED` | `CANCELLED`

---

### File

Uploaded file metadata. Actual file data lives in storage (local filesystem or S3/R2).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PK, CUID | - |
| `filename` | `String` | - | Stored filename (may differ from original) |
| `originalName` | `String` | - | User-provided filename |
| `mimeType` | `String` | - | Detected MIME type |
| `size` | `Int` | - | File size in bytes |
| `storageKey` | `String` | Unique | Path/key in storage backend |
| `storageProvider` | `String` | Default: `"local"` | `"local"` or `"s3"` |
| `uploadedById` | `String?` | FK → User | Uploader (null = orphaned) |
| `createdAt` | `DateTime` | Default: `now()` | - |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

**Indexes:** `uploadedById`, `mimeType`, `createdAt`

**Cascade:** Deleting a user sets `uploadedById` to null (file is preserved but orphaned). A background job (`FILE_CLEANUP`) runs every 24h to remove orphaned files from both storage and database.

**Query helpers:** `file.create()`, `file.findById()`, `file.findByStorageKey()`, `file.findByUploader()`, `file.findOrphaned()`, `file.findOlderThan()`, `file.delete()`, `file.deleteMany()`, `file.count()`

---

### AuditLog

Immutable audit trail for user actions. Append-only - no update or delete queries exist.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PK, CUID | - |
| `userId` | `String` | FK → User | Who performed the action |
| `action` | `String` | - | Action name (e.g. `"create"`, `"delete"`) |
| `entity` | `String` | - | Entity type (e.g. `"post"`, `"user"`) |
| `entityId` | `String` | - | ID of the affected entity |
| `changes` | `Json?` | - | Before/after field values |
| `metadata` | `Json?` | - | Additional context (IP, user agent, etc.) |
| `createdAt` | `DateTime` | Default: `now()` | - |

**Indexes:** `userId`, `action`, `entity`, `createdAt`

**Query helpers:** `auditLog.findAll()`, `auditLog.findByUserId()`, `auditLog.findByEntity()`, `auditLog.findByAction()`, `auditLog.create()`

---

## Migration History

| Migration | Date | Description |
|-----------|------|-------------|
| `0_init` | Initial | Base schema: User, Account, Session, VerificationToken |
| `20260214_add_jobs_*` | 2026-02-14 | Add Job model with JobStatus enum |
| `20260214_add_files_*` | 2026-02-14 | Add File model |
| `20260214_add_audit_log_*` | 2026-02-14 | Add AuditLog model |
| `20260215_add_account_timestamps` | 2026-02-15 | Add createdAt/updatedAt to Account |
| `20260215_add_indexes` | 2026-02-15 | Add expires index on Session/VerificationToken, compound index on Job |
| `20260218_remove_post` | 2026-02-18 | Remove Post model - use domain-specific models per project |

---

## Best Practices

### Extending the Schema

1. Add the model to `packages/db/prisma/schema.prisma`
2. Create a migration: `pnpm db:migrate --name describe_change`
3. Add query helpers in `packages/db/src/queries.js`
4. Always include `createdAt`/`updatedAt` on new models
5. Add appropriate indexes for query patterns
6. Run `pnpm --filter @usequark/quark-create-app sync-templates` to update scaffold templates
7. If the schema changed, regenerate the template's initial migration

### Query Patterns

- **Always use `USER_SAFE_SELECT`** when returning user data to clients
- **Never expose `password`** - only `user.findByEmail()` returns it for auth
- **Use pagination** - all `findAll()` and `findMany()` helpers accept `{ skip, take }`
- **Default ordering** - all list queries order by `createdAt: "desc"`
- **Cascade deletes** - understand which relations cascade before deleting parent records

### Adding a New Entity

```javascript
// 1. Add Prisma model (schema.prisma)
model Widget {
  id        String   @id @default(cuid())
  name      String
  createdBy String
  creator   User     @relation(fields: [createdBy], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([createdBy])
  @@index([createdAt])
}

// 2. Add query helpers (queries.js)
export const widget = {
  findById: (id) => prisma.widget.findUnique({ where: { id } }),
  findAll: (options = {}) => {
    const { skip = 0, take = 10 } = options;
    return prisma.widget.findMany({ skip, take, orderBy: { createdAt: "desc" } });
  },
  create: (data) => prisma.widget.create({ data }),
  update: (id, data) => prisma.widget.update({ where: { id }, data }),
  delete: (id) => prisma.widget.delete({ where: { id } }),
};

// 3. Add Zod schema (schemas.js)
export const widgetCreateSchema = z.object({
  name: z.string().min(1),
});
```

---

## Index Strategy

| Pattern | Index Type | Purpose |
|---------|-----------|---------|
| FK lookups | Single column | `authorId`, `userId`, `uploadedById` |
| Unique constraints | Unique | `email`, `sessionToken`, `storageKey` |
| Filtering | Single column | `published`, `status`, `mimeType`, `action`, `entity` |
| Sorting/pagination | Single column | `createdAt` on all models |
| Expiry cleanup | Single column | `expires` on Session, VerificationToken |
| Composite query | Compound | `(status, runAt)` on Job for queue polling |
