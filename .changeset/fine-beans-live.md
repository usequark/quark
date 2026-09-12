---
"@techstream/quark-create-app": minor
---

Remove domain vertical models (CRM, CMS, AI, Booking, Admin) from default scaffold. Domain features are now taught via embedded skills and added on demand, keeping the initial scaffold lean. The Prisma schema trimming logic (`trimPrismaSchema`) and domain-specific template directories (`admin/`, `admin-routes/`, `skills/admin-dashboard/`, `skills/ai/`, `skills/bookings/`, `skills/cms/`, `skills/crm/`) are removed.
