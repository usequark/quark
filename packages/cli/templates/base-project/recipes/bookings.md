---
name: Add a booking system
feature: bookings
files:
  - packages/db/prisma/booking.prisma
  - apps/web/src/app/api/bookings/route.js
  - apps/web/src/app/api/bookings/[id]/route.js
depends: [db]
---

## What this builds

A generic booking system: a `Booking` model plus a CRUD endpoint. This is a lean starting point — you extend it with services, staff, availability slots, and scheduling rules as your product needs them.

## Files created

| File | Purpose |
|------|---------|
| `packages/db/prisma/booking.prisma` | Generic `Booking` model (merge into `schema.prisma`) |
| `apps/web/src/app/api/bookings/route.js` | `GET` (list) + `POST` (create) |
| `apps/web/src/app/api/bookings/[id]/route.js` | `GET` (read) + `PATCH` (update) + `DELETE` |

## Patterns to follow

- Merge `booking.prisma` into `packages/db/prisma/schema.prisma`, then `pnpm db:generate && pnpm db:migrate`.
- Every model includes `id`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`.
- Use `prisma.booking.*` via query helpers in `packages/db/src/queries.js` — do not call `prisma.*` directly in pages.
- Follow the existing `apps/web/src/app/api/users/route.js` as reference.

## Extension path

The generic starter covers the core. To build a real booking system, extend with:

- **Services & staff** — add `ServiceType`, `Staff`, and `StaffService` models; relate them to `Booking`.
- **Availability** — add an `AvailabilitySlot` model with capacity and booked-count tracking.
- **Scheduling rules** — enforce no double-booking, slot capacity, and staff availability in the create action.
- **Reminders** — dispatch a background job on booking creation (see `CLAUDE.md` background-jobs section).
- **Cancellation** — add a `cancelToken` and a public cancel flow.

## Prompt to paste

```text
Build the booking system described in recipes/bookings.md.

Read CLAUDE.md first, then:
1. Merge packages/db/prisma/booking.prisma into schema.prisma and migrate.
2. Add query helpers for Booking to packages/db/src/queries.js.
3. Wire up the CRUD endpoint at apps/web/src/app/api/bookings/.
4. Extend with services, staff, and availability per the extension path.
5. Add a test near the changed code.
```
