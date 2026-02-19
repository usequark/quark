---
"@techstream/quark-core": patch
"@techstream/quark-create-app": minor
---

Refactor database connection string logic and enhance environment validation:

- **feat:** Add Railway deployment configuration for web and worker services with health checks and restart policies
- **feat:** Enhance environment validation with service-scoped checks (web/worker) and cross-field validation
- **feat:** Add APP_NAME configuration variable for metadata, emails, and page titles
- **feat:** Centralize PostgreSQL connection string builder in shared module (`connection.js`)
- **refactor:** Simplify database client and Prisma config to use shared connection builder
- **refactor:** Update mail configuration for local development (Mailpit) with cleaner env var handling
- **test:** Add comprehensive unit tests for PostgreSQL connection string builder covering all scenarios
- **chore:** Update Biome schema to 2.4.2
