---
"@techstream/quark-create-app": minor
---

feat: archive vertical packages and remove vertical code from the monorepo

- **Archived the vertical packages** (`@techstream/quark-ai`, `@techstream/quark-cms`, `@techstream/quark-crm`, `@techstream/quark-bookings`) to `reference/verticals/packages/`. They are now reference implementations only — the skills point to them.
- **Removed the vertical code from the monorepo's apps**: the AI/CRM/bookings API routes, the CMS content subsystem, and the worker AI handlers are gone from `apps/web` and `apps/worker`. The monorepo now reflects the minimal scaffold (infrastructure + skills).
- The scaffold was already clean; this removes the vertical code from the monorepo's own reference apps.
