---
name: bookings
description: Build a booking, reservation, appointment, or scheduling system on Quark. Use when the user wants bookings, reservations, appointments, slots, or scheduling.
---

# Bookings Skill

Build a user-specific booking system on Quark's infrastructure. This skill gives you the domain context, the Quark framework patterns, and the end-result shape. You generate the code that fits the user's exact requirements.

## Context

A booking system manages reservations of a resource (a service, a lane, a room, a staff member) against time. The core entities and concerns:

- **Booking** — the reservation: who, what, when, for how long, status.
- **Resource** — what is being booked (service, staff, room, lane).
- **Availability** — which slots are open, capacity, and booked-count.
- **Scheduling rules** — no double-booking, capacity limits, staff availability.
- **Lifecycle** — pending → confirmed → cancelled / completed.
- **Reminders & notifications** — background jobs on booking events.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **API routes** live in `apps/web/src/app/api/<resource>/`. Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`. Follow `apps/web/src/app/api/users/route.js` as the reference shape.
- **Server Actions** (preferred for mutations) use `"use server"`, Zod validation, and `AppError`/`ValidationError` from `@techstream/quark-core/errors`.
- **Background jobs** (reminders, notifications) dispatch via `createQueue`/`addJob` from `@techstream/quark-core` and handle in `apps/worker/src/handlers/`.
- **Auth** via `getCurrentSession` from `@techstream/quark-core`.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Clarify the user's requirements: what is being booked, by whom, with what constraints.
3. Design the Prisma models (Booking + resource + availability) and add query helpers.
4. Build the CRUD endpoint(s) with auth + Zod validation.
5. Add the scheduling rules (no double-booking, capacity) in the create action.
6. Add background jobs for reminders/notifications if required.
7. Add tests near the changed code.

## End result

A working booking system where users can view availability, create a booking, and have it validated against capacity and scheduling rules — with the models, endpoints, and jobs following Quark conventions.

## Reference

A full reference implementation is archived at `reference/verticals/bookings/`. Study it for the complete model set, validation, and scheduling logic, then adapt to the user's requirements.
