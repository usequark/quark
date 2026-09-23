---
"@techstream/quark-core": minor
---

Add `admin`, `auth/middleware`, `core`, `db`, `email`, `metrics`, `queue`, `sms`, and `storage/s3` subpath exports. The S3 adapter now lives in its own module and loads the optional `@aws-sdk/*` peer dependencies lazily, so `@techstream/quark-core/storage` and the main barrel no longer require them at import time. `pingDatabase()` imports its optional `pg` peer lazily for the same reason, and `createPrismaClient()` namespaces its singleton per client instead of sharing one global slot. Existing `./locale`, `./logger`, and `./stripe` subpaths are unchanged.
