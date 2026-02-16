---
"@techstream/quark-create-app": patch
---

fix: complete file upload template, fix migration drift, and clean up orphaned Docker volumes

- **Docker volume cleanup:** Automatically remove orphaned Docker volumes from previous projects with the same name, preventing `P1000: Authentication failed` errors when re-scaffolding
- Add missing `File` model to template `schema.prisma` with `User` relation
- Add `file` query builder to template `queries.js` (create, findById, findByUploader, findOrphaned, delete, etc.)
- Add `fileUploadSchema` Zod schema to template `schemas.js`
- Add `File` table, indexes, and foreign key to template initial migration SQL
- Fix migration SQL drift: add `Account.createdAt`/`updatedAt` columns, `Session.expires` index, `VerificationToken.expires` index, and `Job(status, runAt)` compound index
- Register `quark-update` as a bin alias so `npx quark-update` works
- Fix post-scaffolding output to show `npx @techstream/quark-create-app update`
