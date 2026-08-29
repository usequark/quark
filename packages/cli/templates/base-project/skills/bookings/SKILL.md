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

## Example models

The base schema ships with `ServiceType`, `AvailabilitySlot`, `Booking`, and `BookingStatus`. When staff assignment is needed, add `Staff` and `StaffService` models.

### Core models (always present)

```prisma
enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

model ServiceType {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  duration    Int      // minutes
  price       Float?
  currency    String?  @default("USD")
  color       String?
  capacity    Int      @default(1) // max simultaneous bookings per slot
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AvailabilitySlot {
  id          String      @id @default(cuid())
  serviceId   String
  service     ServiceType @relation(fields: [serviceId], references: [id])
  slotScopeKey String     // composite key: "service:<serviceId>" or "staff:<staffId>:service:<serviceId>"
  staffId     String?
  startTime   DateTime
  endTime     DateTime
  capacity    Int         @default(1)
  bookedCount Int         @default(0)
  active      Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  bookings Booking[]

  @@unique([serviceId, startTime, endTime])
  @@unique([slotScopeKey, startTime, endTime])
  @@index([slotScopeKey, staffId, startTime, endTime])
  @@index([serviceId, staffId, startTime, endTime])
  @@index([startTime, endTime])
  @@index([active, startTime])
}

model Booking {
  id              String          @id @default(cuid())
  userId          String?
  user            User?           @relation(fields: [userId], references: [id])
  slotId          String
  slot            AvailabilitySlot @relation(fields: [slotId], references: [id])
  serviceTypeId   String
  serviceType     ServiceType     @relation(fields: [serviceTypeId], references: [id])
  staffId         String?
  durationMinutes Int             @default(30)
  name            String
  email           String
  phone           String?
  notes           String?         @db.Text
  customFields    Json?
  status          BookingStatus   @default(PENDING)
  cancelledAt     DateTime?
  cancelledReason String?
  cancelToken     String?         @unique
  reminderSent    Boolean         @default(false)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([slotId, email])
  @@index([userId, status])
  @@index([slotId, status])
  @@index([email, status])
  @@index([createdAt])
  @@index([cancelToken])
}
```

### Staff assignment models (add when needed)

Add these models when the booking system requires staff assignment. Run `pnpm db:generate && pnpm db:migrate` after adding.

```prisma
model Staff {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  title     String?
  bio       String?  @db.Text
  image     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  services  StaffService[]
  slots     AvailabilitySlot[]
  bookings  Booking[]

  @@index([active])
}

model StaffService {
  id        String      @id @default(cuid())
  staffId   String
  staff     Staff       @relation(fields: [staffId], references: [id], onDelete: Cascade)
  serviceId String
  service   ServiceType @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@unique([staffId, serviceId])
}
```

## slotScopeKey

`AvailabilitySlot.slotScopeKey` is a composite key that partitions the slot uniqueness space. Use it to allow the same time range for different scopes without collisions.

- **Service-only slot:** `"service:<serviceId>"` — one slot per service per time range.
- **Staff-scoped slot:** `"staff:<staffId>:service:<serviceId>"` — one slot per staff member per time range, allowing different staff to offer the same service at overlapping times.

When creating slots, compute the scope key from the combination of staff and service. The `@@unique([slotScopeKey, startTime, endTime])` constraint enforces no duplicate slots within a scope.

## Booking status state machine

```
PENDING → CONFIRMED (admin confirm or auto-confirm)
PENDING → CANCELLED (guest self-service via cancelToken)
CONFIRMED → COMPLETED (manual or auto after slot end)
CONFIRMED → CANCELLED (admin or guest within policy window)
CONFIRMED → NO_SHOW (admin manual)
```

### State machine implementation (JS)

```js
const TRANSITIONS = {
  PENDING:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["COMPLETED", "CANCELLED", "NO_SHOW"],
  CANCELLED:  [],
  COMPLETED:  [],
  NO_SHOW:    [],
};

/**
 * Check whether a status transition is allowed.
 * @param {string} from - current status
 * @param {string} to - desired new status
 * @returns {boolean}
 */
export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Apply a status transition to a booking record.
 * Sets cancelledAt / cancelledReason when transitioning to CANCELLED.
 * Throws ValidationError if the transition is not allowed.
 * @param {object} booking - current booking record
 * @param {string} newStatus - desired status
 * @param {object} [opts] - optional metadata (reason, etc.)
 * @returns {object} update payload for prisma.booking.update
 */
export function applyTransition(booking, newStatus, opts = {}) {
  if (!canTransition(booking.status, newStatus)) {
    throw new ValidationError(
      `Cannot transition from ${booking.status} to ${newStatus}`
    );
  }

  const data = { status: newStatus };

  if (newStatus === "CANCELLED") {
    data.cancelledAt = new Date();
    if (opts.reason) {
      data.cancelledReason = opts.reason;
    }
  }

  return data;
}
```

## Capacity management

Check `slot.bookedCount < slot.capacity` before confirming a booking. Use a Prisma transaction with a row-level lock to prevent race conditions:

```js
import { prisma } from "@__QUARK_SCOPE__/db";

async function createBooking(slotId, bookingData) {
  return prisma.$transaction(async (tx) => {
    // Lock the slot row to prevent concurrent overbooking
    const slot = await tx.$queryRaw`
      SELECT * FROM "AvailabilitySlot"
      WHERE id = ${slotId} AND active = true
      FOR UPDATE
    `;

    if (!slot[0]) throw new AppError("Slot not found", 404, "NOT_FOUND");
    if (slot[0].booked_count >= slot[0].capacity) {
      throw new AppError("Slot is full", 409, "SLOT_FULL");
    }

    // Increment bookedCount atomically
    await tx.availabilitySlot.update({
      where: { id: slotId },
      data: { bookedCount: { increment: 1 } },
    });

    return tx.booking.create({
      data: { slotId, ...bookingData },
    });
  });
}
```

## Payment integration

For paid services, collect a deposit or full payment at booking time. Reference the payment skill for Stripe Checkout integration. Key pattern:

1. Create the booking in `PENDING` status.
2. Generate a Stripe Checkout Session with the service price and a `metadata.bookingId`.
3. Redirect the customer to the Checkout URL.
4. Handle the `checkout.session.completed` webhook to move the booking to `CONFIRMED`.
5. On cancellation, issue a refund via the Stripe API if within the refund window.

Store the Stripe session ID on the booking (add a `stripeSessionId String?` field) to link payment events back to bookings.

## Example validation schema

```js
const createBookingSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  date: z.string().min(1),
  startTime: z.string().min(1),
  durationMins: z.number().int().positive(),
  notes: z.string().optional(),
});
```

## Example test pattern

```js
import { test } from "node:test";
import assert from "node:assert";

test("create booking rejects double-booking", async () => {
  // arrange → act → assert
  // Use a model factory from @techstream/quark-core/testing.
});

test("canTransition allows valid transitions", () => {
  assert.ok(canTransition("PENDING", "CONFIRMED"));
  assert.ok(!canTransition("PENDING", "COMPLETED"));
  assert.ok(!canTransition("CANCELLED", "CONFIRMED"));
});

test("applyTransition sets cancelledAt for cancellations", () => {
  const booking = { status: "CONFIRMED" };
  const update = applyTransition(booking, "CANCELLED", { reason: "Changed plans" });
  assert.strictEqual(update.status, "CANCELLED");
  assert.ok(update.cancelledAt instanceof Date);
  assert.strictEqual(update.cancelledReason, "Changed plans");
});

test("applyTransition throws on invalid transition", () => {
  const booking = { status: "CANCELLED" };
  assert.throws(() => applyTransition(booking, "CONFIRMED"), /Cannot transition/);
});
```

## End result

A working booking system where users can view availability, create a booking, and have it validated against capacity and scheduling rules — with the models, endpoints, and jobs following Quark conventions.


