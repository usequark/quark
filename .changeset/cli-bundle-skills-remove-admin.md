---
"@techstream/quark-create-app": minor
---

Bundle all embedded skills with every scaffold and remove the admin dashboard UI. The CLI no longer asks which skills to include — features are now `ui` and `jobs` only, and all skills (including a new `admin-dashboard` skill preserving the CRUD-generation patterns and a `quark-skills` index) ship with every build. The `admin`, `bookings`, `crm`, `cms`, and `ai` feature flags are removed; the dev seed no longer inserts domain-specific demo data; the scaffolded README now includes the `pnpm db:seed` step.
