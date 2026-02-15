---
"@techstream/quark-core": minor
"@techstream/quark-create-app": minor
---

feat: add file upload, validation, and storage system

- Add file validation module with MIME type checking, size limits, and malicious content detection
- Add multipart form data parsing utilities
- Add pluggable storage adapters (local filesystem and S3-compatible)
- Add File model to Prisma schema with associated queries and Zod schemas
- Add file processing job definition
- Add file upload/download API routes to the web app
- Add email and file processing handlers to the worker
- Update CLI templates to include file upload infrastructure
