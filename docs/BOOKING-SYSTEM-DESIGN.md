# Booking System - Design & Implementation Plan

## Overview

A **Bookings** feature package for the Quark scaffolding ecosystem (`@techstream/quark-create-app`). Follows existing CMS/CRM conventions. Opt-in at scaffold time (not auto-selected). Supports multi-staff, guest + authenticated bookings, public-facing booking pages, and background email notifications.

---

## Feature Specification

| Aspect | Decision |
|---|---|
| **Auth model** | Guest (name + email) AND authenticated bookings |
| **Staff model** | Multi-staff - each staff member assigned to services they perform |
| **Recurring bookings** | No (v2) |
| **Payment** | Price metadata only - no payment processing or hooks |
| **Public pages** | Included by default when bookings feature is selected |
| **Scaffold selection** | Opt-in (unchecked by default in prompt) |

---

## Database Schema

Four new models in `packages/db/prisma/schema.prisma`:

```prisma
enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

model Staff {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  title     String?                          // e.g. "Senior Stylist"
  bio       String?  @db.Text
  image     String?                          // photo URL
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

model ServiceType {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  duration    Int                          // minutes
  price       Float?
  currency    String?  @default("USD")
  color       String?                      // hex for calendar display
  capacity    Int      @default(1)         // max simultaneous bookings per slot
  active      Boolean  @default(true)
  image       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  staff   StaffService[]
  slots   AvailabilitySlot[]
  bookings Booking[]

  @@index([active])
}

model AvailabilitySlot {
  id          String      @id @default(cuid())
  serviceId   String
  service     ServiceType @relation(fields: [serviceId], references: [id])
  staffId     String?
  staff       Staff?      @relation(fields: [staffId], references: [id])
  startTime   DateTime
  endTime     DateTime
  capacity    Int         @default(1)
  bookedCount Int         @default(0)
  active      Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  bookings Booking[]

  @@index([serviceId, staffId, startTime, endTime])
  @@index([startTime, endTime])
  @@index([active, startTime])
}

model Booking {
  id              String         @id @default(cuid())
  userId          String?
  user            User?          @relation(fields: [userId], references: [id])
  slotId          String
  slot            AvailabilitySlot @relation(fields: [slotId], references: [id])
  serviceTypeId   String
  serviceType     ServiceType    @relation(fields: [serviceTypeId], references: [id])
  staffId         String?
  staff           Staff?         @relation(fields: [staffId], references: [id])
  name            String                      // booker's name
  email           String                      // booker's email
  phone           String?
  notes           String?        @db.Text
  customFields    Json?                       // extensible key-value metadata
  status          BookingStatus  @default(PENDING)
  cancelledAt     DateTime?
  cancelledReason String?
  cancelToken     String?        @unique     // self-service cancel URL token
  reminderSent    Boolean        @default(false)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([userId, status])
  @@index([slotId, status])
  @@index([email, status])
  @@index([createdAt])
  @@index([cancelToken])
}
```

### Entity Relationships

```
Staff ──┬── StaffService ──┬── ServiceType ──┬── AvailabilitySlot ──┬── Booking ──┬── User
        │                  │                 │                     │            │
        └──────────────────┘                 └─────────────────────┘            │
                                                                                 │
        Staff ──────────────────────────────────────────────────── Booking       │
                                                                                 │
        ServiceType ────────────────────────────────────────────── Booking       │
```

- **Staff ↔ ServiceType**: many-to-many via `StaffService` junction
- **Staff → AvailabilitySlot**: one-to-many (a slot belongs to one staff)
- **ServiceType → AvailabilitySlot**: one-to-many (a slot is for one service)
- **AvailabilitySlot → Booking**: one-to-many (a slot can hold multiple bookings up to capacity)
- **User → Booking**: optional one-to-many (nullable for guest bookings)

---

## Booking Status State Machine

```
                 ┌──────────┐
                 │  PENDING  │
                 └─────┬─────┘
                       │ confirm
                 ┌─────▼─────┐
           ┌─────│ CONFIRMED │─────┐
           │     └─────┬─────┘     │
           │ cancel    │ complete   │ mark no-show
     ┌─────▼─────┐    │      ┌─────▼─────┐
     │ CANCELLED  │    │      │  NO_SHOW   │
     └────────────┘    │      └────────────┘
                 ┌─────▼─────┐
                 │ COMPLETED  │
                 └────────────┘
```

### Valid Transitions

| From | To | Context |
|---|---|---|
| PENDING | CONFIRMED | Admin confirmation or auto-confirm via config |
| PENDING | CANCELLED | Guest self-service via cancelToken |
| CONFIRMED | COMPLETED | Manual mark or auto-complete after slot end |
| CONFIRMED | CANCELLED | Admin action or guest self-service (within policy window) |
| CONFIRMED | NO_SHOW | Admin manual action |

Transition guard: `canTransition(from, to)` returns boolean. `applyTransition(booking, newStatus)` applies side effects (sets `cancelledAt`, generates `cancelToken`, etc.). Same pattern as `packages/cms/src/status.js`.

---

## Package Architecture

### Location: `packages/bookings/`

```
packages/bookings/
  package.json
  src/
    index.js            # Barrel re-export of all public modules
    config.js           # bookingsConfig - central configuration object
    status.js           # BookingStatus state machine
    availability.js     # Slot availability calculator + conflict detection
    validation.js       # Zod schemas (booking, service, slot, cancellation)
    queries.js          # Query helpers (createBooking, cancelBooking, findSlots, etc.)
```

### package.json

```jsonc
{
  "name": "@techstream/quark-bookings",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./config": "./src/config.js",
    "./status": "./src/status.js",
    "./availability": "./src/availability.js",
    "./validation": "./src/validation.js",
    "./queries": "./src/queries.js"
  },
  "dependencies": {
    "@techstream/quark-admin": "workspace:*",
    "@techstream/quark-core": "workspace:*",
    "zod": "^4.3.6"
  }
}
```

### Module Reference

#### `src/config.js` - Central Configuration

```js
export const bookingsConfig = {
  // --- Scheduling ---
  scheduling: {
    slotInterval: 30,              // minutes (30 = slots at :00 and :30)
    defaultServiceDuration: 60,    // minutes (fallback if service has no duration)
    bufferBetweenSlots: 15,        // minutes buffer after each slot
    minAdvanceNotice: 60,          // minutes (must book at least 1 hour before)
    maxAdvanceBooking: 86400 * 90, // minutes (90 days out)
    timezone: "America/New_York",  // display timezone for public pages
    workingHours: {
      monday:    { start: "09:00", end: "17:00" },
      tuesday:   { start: "09:00", end: "17:00" },
      wednesday: { start: "09:00", end: "17:00" },
      thursday:  { start: "09:00", end: "17:00" },
      friday:    { start: "09:00", end: "17:00" },
      saturday:  null,             // null = closed
      sunday:    null,
    },
  },

  // --- Notifications ---
  notifications: {
    sendConfirmation: true,
    sendCancellation: true,
    sendReminder: true,
    reminderBeforeMinutes: 1440,   // 24 hours
  },

  // --- Cancellation Policy ---
  cancellation: {
    enabled: true,
    minHoursBeforeSlot: 24,        // must cancel at least 24h before
    allowReason: true,             // require/suggest cancellation reason
  },

  // --- Public Booking ---
  public: {
    allowGuestBookings: true,
    requirePhone: false,
    requireAccount: false,         // if true, guests redirected to sign-in
    maxBookingsPerSlot: 1,         // max seats one person can book per slot
  },

  // --- Admin ---
  admin: {
    pageSize: 25,
    slotCalendarRange: 60,         // days shown in calendar by default
  },
};
```

#### `src/status.js` - State Machine

| Export | Signature | Purpose |
|---|---|---|
| `BOOKING_TRANSITIONS` | `Record<BookingStatus, BookingStatus[]>` | Allowed transitions map |
| `canTransition(from, to)` | `(string, string) => boolean` | Validate transition legality |
| `applyTransition(booking, newStatus)` | `(object, string) => object` | Apply + return booking with side effects |

Side effects applied by `applyTransition`:
- Setting `CANCELLED`: sets `cancelledAt = new Date()`
- Setting `PENDING` (initial): generates `cancelToken = crypto.randomUUID()`

#### `src/availability.js` - Slot Management

| Export | Purpose |
|---|---|
| `getAvailableSlots({ prisma, serviceId, staffId, dateFrom, dateTo })` | Returns slots where `bookedCount < capacity` and `active = true`, filtered by service/staff/date range |
| `checkSlotAvailability({ prisma, slotId })` | Atomically checks and increments `bookedCount`. Returns `false` if full. Guards against double-booking. |
| `generateSlots({ prisma, serviceId, staffId, dateFrom, dateTo, pattern })` | Bulk-generates `AvailabilitySlot` records from working hours config and optional recurrence pattern |
| `releaseSlot({ prisma, slotId })` | Atomically decrements `bookedCount` (called on cancellation) |

#### `src/validation.js` - Zod Schemas

| Export | Purpose |
|---|---|
| `bookingSchema` | Validates: `name` (1-200), `email`, `slotId`, `serviceTypeId`, `staffId` (optional), `phone` (optional), `notes` (optional), `customFields` (optional JSON) |
| `serviceTypeSchema` | Validates: `name` (1-200), `description`, `duration` (positive int), `price` (optional non-negative), `capacity` (positive int), `active` |
| `slotSchema` | Validates: `serviceId`, `staffId` (optional), `startTime`, `endTime` (after startTime), `capacity` |
| `slotBulkSchema` | Validates: `serviceId`, `staffId` (optional), `dateFrom`, `dateTo`, `pattern` |
| `cancelBookingSchema` | Validates: `cancelledReason` (optional string) |

All schemas use `z.preprocess()` for normalization and throw `ValidationError` from `@techstream/quark-core/errors`.

#### `src/queries.js` - Query Helpers

| Export | Purpose |
|---|---|
| `createBooking({ prisma, ...data })` | Transaction: checks slot availability, creates booking with PENDING status, generates cancelToken, optionally enqueues confirmation email |
| `cancelBooking({ prisma, bookingId, reason })` | Validates transition via `canTransition`, applies `applyTransition`, releases slot, enqueues cancellation email |
| `confirmBooking({ prisma, bookingId })` | Admin action: validates transition, applies CONFIRMED status, enqueues confirmation email |
| `completeBooking({ prisma, bookingId })` | Admin action: marks COMPLETED |
| `findBookingById({ prisma, id })` | Detail with includes (slot, serviceType, staff, user) |
| `findBookings({ prisma, filters })` | Paginated list with filters: `status`, `serviceId`, `staffId`, `dateFrom`, `dateTo`, `search` |
| `findBookingByCancelToken({ prisma, token })` | Self-service booking lookup |

---

## Admin Routes

### Location: `apps/web/src/app/admin/bookings/`

```
admin/bookings/
  page.js                             # Dashboard: stats cards (total today, upcoming, cancelled) + recent bookings
  staff/
    page.js                           # Staff list table
    new/page.js                       # Create staff member form
    [id]/page.js                      # Edit staff + service assignment multi-select
  services/
    page.js                           # Service type list table
    new/page.js                       # Create service type form
    [id]/page.js                      # Edit service type + staff assignment
  slots/
    page.js                           # Calendar view (week/month toggle, colored by ServiceType.color)
    new/page.js                       # Bulk slot generator form (date range, staff filter, time pattern)
    [id]/page.js                      # Edit individual slot (time, capacity, staff, service)
  bookings/
    page.js                           # List with filters: status tabs, date range picker, service dropdown, staff dropdown
    new/page.js                       # Admin-side manual booking (select service → staff → slot → enter customer info)
    [id]/page.js                      # Detail view: all booking fields, status badge, action buttons (confirm/cancel/complete/no-show)
  _actions/
    staff.js                          # "use server": createStaff, updateStaff, deleteStaff, assignServiceToStaff
    services.js                       # "use server": createService, updateService, deleteService
    slots.js                          # "use server": createSlot, updateSlot, deleteSlot, generateSlots
    bookings.js                       # "use server": createBooking, confirmBooking, cancelBooking, completeBooking, markNoShow
  _components/
    BookingCalendar.js                # Client component: calendar grid rendering slots, click to create/edit
    BookingForm.js                    # Client component: admin booking form with cascading selects
    SlotGenerator.js                  # Client component: bulk slot creation form
    StaffServiceAssignment.js         # Client component: multi-select staff ⇄ service mapping
    StatusBadge.js                    # Client component: color-coded booking status pill
    BookingFilters.js                 # Client component: filter bar for booking list
```

### Conventions

- **Pages**: Server Components (`export default async function`)
- **Components**: Client Components in `_components/` (`"use client"`)
- **Actions**: Server Actions in `_actions/` (`"use server"`)
- **Auth**: `requireRole(["admin", "editor"])` at top of each action
- **Forms**: `useActionState` + `useTransition`, actions bound with `.bind(null, id)` for edit
- **Feedback**: Redirect with `?toast=success-message` query param
- **Imports**: `@techstream/quark-ui` for components, no deep imports from `@/components/ui/`

### Sidebar Integration

Admin sidebar (`apps/web/src/app/admin/layout.js`) adds Bookings as a custom link section:

```js
const customLinks = [
  // existing CRM link...
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: (/* CalendarDays icon from lucide-react */),
    children: [
      { href: "/admin/bookings/bookings", label: "Bookings" },
      { href: "/admin/bookings/staff", label: "Staff" },
      { href: "/admin/bookings/services", label: "Services" },
      { href: "/admin/bookings/slots", label: "Slots" },
    ],
  },
];
```

---

## Public-Facing Pages

### Location: `apps/web/src/app/bookings/`

```
app/bookings/
  page.js                             # Service selection page: card grid of available services
  [service]/page.js                   # Booking flow: staff picker → date/time picker → details form → confirmation
  confirmation/[id]/page.js           # Post-booking confirmation: summary, add-to-calendar, share info
  cancel/[id]/page.js                 # Self-service cancellation: validates cancelToken, shows booking details, confirms cancel
  _components/
    BookingFlow.js                    # Multi-step client component (service → staff → slot → details → confirm)
    TimeSlotPicker.js                 # Date picker + time grid showing available slots with remaining capacity
    ServiceCard.js                    # Service display card (name, duration, price, description, image)
    StaffPicker.js                    # Staff selector (avatar, name, title)
    BookingSidebar.js                 # Summary sidebar (service, staff, date, time, price) - visible during flow
    CancellationForm.js               # Reason input + confirm button for self-service cancel
    BookingConfirmation.js            # Final confirmation display with details
```

### Guest Booking Flow

```
/booking                     → Browse services
/booking/[service]           → Pick staff → Pick date/time slot → Enter name/email/phone/notes
                               → POST to server action → Redirect to confirmation
/booking/confirmation/[id]   → View booking summary
```

### Authenticated Booking Flow

Same as guest, but name/email are pre-filled from session. Booking is linked to `userId`.

### Self-Service Cancellation

URL format: `/booking/cancel/abc123?token=<cancelToken-uuid>`

```
1. Load page → validate cancelToken against DB
2. Show booking details (service, date, time, staff)
3. Show cancellation policy (e.g. "Cancel at least 24 hours before")
4. If within policy window: show reason field + Cancel button
5. If outside policy window: show "Cannot cancel - contact us" message
6. On submit: call cancelBooking server action → redirect to confirmation
```

---

## Email Notifications

### Job Definitions (`packages/jobs/src/definitions.js`)

```js
export const JOB_NAMES = {
  // ... existing
  SEND_BOOKING_CONFIRMATION: "send-booking-confirmation",
  SEND_BOOKING_CANCELLATION: "send-booking-cancellation",
  SEND_BOOKING_REMINDER:     "send-booking-reminder",
};
```

All enqueued on `JOB_QUEUES.EMAIL`.

### Email Templates (`packages/core/src/email-templates.js`)

| Template Function | Subject | Key Data Fields |
|---|---|---|
| `bookingConfirmationEmail(data)` | `"Booking confirmed - {appName}"` | name, serviceName, staffName, date, time, duration, price, location |
| `bookingCancellationEmail(data)` | `"Booking cancelled - {appName}"` | name, serviceName, date, cancelledReason |
| `bookingReminderEmail(data)` | `"Upcoming booking - {appName}"` | name, serviceName, staffName, date, time, duration |

Each template follows the existing convention:
- Returns `{ subject, html, text }`
- HTML wrapped in shared `layout()` helper
- User-provided values escaped with `escapeHtml()`

### Worker Handlers (`apps/worker/src/handlers/`)

#### `email.js` - new exports

```js
export async function handleSendBookingConfirmation(bullJob, logger) {
  // 1. Validate: require userId, bookingId, serviceTypeId, staffId
  // 2. Fetch: user (email, name), booking, serviceType, staff
  // 3. Render: bookingConfirmationEmail({ name, serviceName, staffName, date, time, duration })
  // 4. Send: emailService.sendEmail(to, subject, html, text)
  // 5. Return: { success: true, ... }
}

export async function handleSendBookingCancellation(bullJob, logger) { ... }
export async function handleSendBookingReminder(bullJob, logger) {
  // Also: check reminderSent flag on booking before sending
  // Update booking.reminderSent = true after send
}
```

#### `booking-job-validation.js` - new file

```js
export function requireBookingJobData(data) {
  const { userId, bookingId } = data ?? {};
  if (!userId || !bookingId) {
    throw new ValidationError("userId and bookingId are required");
  }
  return { userId, bookingId };
}
```

#### `handlers/index.js` - registry additions

```js
export const jobHandlers = {
  // ... existing
  [JOB_NAMES.SEND_BOOKING_CONFIRMATION]: handleSendBookingConfirmation,
  [JOB_NAMES.SEND_BOOKING_CANCELLATION]: handleSendBookingCancellation,
  [JOB_NAMES.SEND_BOOKING_REMINDER]:     handleSendBookingReminder,
};
```

### Dispatch Locations

| Trigger | Where | Job Enqueued |
|---|---|---|
| Booking created | `createBooking()` in `queries.js` or server action | `SEND_BOOKING_CONFIRMATION` + `SEND_BOOKING_REMINDER` (delayed) |
| Booking cancelled | `cancelBooking()` in `queries.js` or server action | `SEND_BOOKING_CANCELLATION` |

Dispatch code:
```js
import { createQueue } from "@techstream/quark-core";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";

const emailQueue = createQueue(JOB_QUEUES.EMAIL);
try {
  await emailQueue.add(JOB_NAMES.SEND_BOOKING_CONFIRMATION, {
    userId: session.user.id,
    bookingId: booking.id,
    serviceTypeId: booking.serviceTypeId,
    staffId: booking.staffId,
  });

  // Schedule reminder with delay
  const delayMs = bookingSlot.startTime.getTime()
    - bookingsConfig.notifications.reminderBeforeMinutes * 60 * 1000
    - Date.now();
  if (delayMs > 0) {
    await emailQueue.add(JOB_NAMES.SEND_BOOKING_REMINDER,
      { userId, bookingId },
      { delay: delayMs },
    );
  }
} catch {
  // Non-critical - booking is created even if email queue fails
}
```

---

## Concurrency & Correctness

| Concern | Strategy |
|---|---|
| **Double-booking** | `checkSlotAvailability()` uses atomic Prisma `updateMany` with `where: { id: slotId, bookedCount: { lt: capacity } }`. If 0 rows updated, slot is full - throw `AppError`. Runs inside a transaction with booking creation. |
| **Race on cancel** | `cancelBooking()` uses `updateMany({ where: { id, status: CONFIRMED }, data: { status: CANCELLED } })`. 0 rows = already cancelled / wrong status → throw. |
| **Reminder dedup** | Handler checks `booking.reminderSent` flag before sending. Sets `reminderSent = true` in the same worker execution. Idempotent on retry. |
| **cancelToken uniqueness** | Generated with `crypto.randomUUID()`. Unique constraint on DB column (`@unique`) prevents collisions. |
| **Slot creation overlap** | `generateSlots()` checks for existing slots in the same time range before inserting. If overlap detected for same service+staff, skips or reports conflict. |

---

## CLI Integration

### Changes to `packages/cli/src/index.js`

#### 1. FEATURE_META entry

```js
const FEATURE_META = {
  // ... existing
  bookings: {
    requires: ["admin"],
    packages: ["bookings"],
    pairs: ["bookings-routes", "bookings-public"],
  },
};
```

#### 2. Interactive prompt choice

```js
{
  title: "Bookings (packages/bookings + admin & public pages) [requires: admin, ui]",
  value: "bookings",
  selected: false,
},
```

#### 3. Paired template destinations (create flow)

```js
if (pairedTemplates.includes("bookings-routes")) {
  await copyTemplate(
    "bookings-routes",
    path.join(targetDir, "apps", "web", "src", "app", "admin", "bookings"),
  );
}
if (pairedTemplates.includes("bookings-public")) {
  await copyTemplate(
    "bookings-public",
    path.join(targetDir, "apps", "web", "src", "app", "bookings"),
  );
}
```

#### 4. Paired template destinations (add flow)

Same pattern as create flow, with `replaceImportsInSourceFiles` after copy and existence checks.

#### 5. Other additions

- `workspacePackages` array: add `"bookings"`
- `patchNextConfig` optionalEntries: add `bookings: \`@${scope}/bookings\``
- Feature display in success messages: add bookings row
- `getWorkspacePackagesForFeatures`: already handled (defaults to `[feature]`)

### Changes to `packages/cli/scripts/sync-templates.js`

#### 1. SYNC_DIRS additions

```js
{ src: "packages/bookings", dest: "bookings" },
{ src: "apps/web/src/app/admin/bookings", dest: "bookings-routes" },
{ src: "apps/web/src/app/bookings", dest: "bookings-public" },
```

#### 2. SYNC_FILES additions

If bookings has individual files interleaved with non-bookings code (e.g., public layout changes), add file mappings here.

#### 3. TRANSFORMS additions

```js
"bookings/package.json": transformOptionalPackageJson,
```

#### 4. localExcludes

- Add `bookings/` to `apps/web/src/app/admin` → `admin-routes` excludes
- Add `bookings/` to `apps/web` → `base-project/apps/web` excludes
- Add `bookings/` to `base-project/apps/web/src/app` → base-project excludes

---

## Implementation Phases

### Phase 1: Schema + Core Package (12 files)

- [ ] Add `Staff`, `StaffService`, `ServiceType`, `AvailabilitySlot`, `Booking` models + `BookingStatus` enum to `packages/db/prisma/schema.prisma`
- [ ] Run `pnpm db:migrate dev` to create migration
- [ ] Create `packages/bookings/` directory with `package.json`
- [ ] Implement `src/config.js` - `bookingsConfig` object
- [ ] Implement `src/status.js` - state machine (transitions, canTransition, applyTransition)
- [ ] Implement `src/validation.js` - Zod schemas for booking, serviceType, slot, cancellation
- [ ] Implement `src/availability.js` - getAvailableSlots, checkSlotAvailability, generateSlots, releaseSlot
- [ ] Implement `src/queries.js` - createBooking, cancelBooking, confirmBooking, completeBooking, findBookingById, findBookings, findBookingByCancelToken
- [ ] Implement `src/index.js` - barrel exports
- [ ] Write unit tests for status machine, validation, availability

### Phase 2: Admin UI (20 files)

- [ ] Create `apps/web/src/app/admin/bookings/` directory structure
- [ ] Implement `page.js` - dashboard with stats
- [ ] Implement staff CRUD pages (list, create, edit)
- [ ] Implement service type CRUD pages (list, create, edit)
- [ ] Implement slot pages (calendar view, bulk generator, edit)
- [ ] Implement booking pages (list with filters, manual create, detail with status actions)
- [ ] Implement `_actions/` server actions for staff, services, slots, bookings
- [ ] Implement `_components/` for calendar, forms, filters, badges
- [ ] Add "Bookings" custom link to admin sidebar in `layout.js`

### Phase 3: Notifications (6 files)

- [ ] Add job name constants to `packages/jobs/src/definitions.js`
- [ ] Implement email templates in `packages/core/src/email-templates.js`
- [ ] Implement worker handlers in `apps/worker/src/handlers/email.js`
- [ ] Implement job data validation in `apps/worker/src/handlers/booking-job-validation.js`
- [ ] Register handlers in `apps/worker/src/handlers/index.js`
- [ ] Wire job dispatch into `src/queries.js` booking creation/cancellation

### Phase 4: Public Pages (10 files)

- [ ] Create `apps/web/src/app/bookings/` directory structure
- [ ] Implement service selection page
- [ ] Implement booking flow page (multi-step: staff → slot → details → confirm)
- [ ] Implement confirmation page
- [ ] Implement self-service cancellation page
- [ ] Implement `_components/` for booking flow, time slot picker, staff picker, service card, sidebar

### Phase 5: CLI Integration (3 files modified)

- [ ] Update `packages/cli/src/index.js` with feature registration, prompt, paired templates
- [ ] Update `packages/cli/scripts/sync-templates.js` with SYNC_DIRS, TRANSFORMS, excludes
- [ ] Run `pnpm --filter @techstream/quark-create-app sync-templates` to generate template directories
- [ ] Verify scaffolding with `quark test-project --features bookings` (or equivalent test)

### Phase 6: Tests + Polish (8 files)

- [ ] Integration tests for booking creation flow (guest + authenticated)
- [ ] Integration tests for cancellation flow
- [ ] Integration tests for availability/conflict detection
- [ ] E2E tests for public booking flow
- [ ] Edge case tests: timezone handling, slot capacity overflow, concurrent booking, expired cancelToken
- [ ] iCal feed endpoint (optional)
- [ ] Admin sidebar conditional display (when bookings feature not selected)

---

## Key Constraints

### Must Follow

- **ESM only** - `import`/`export`, never `require()`
- **No TypeScript** - `.js`/`.jsx` files only, no `.ts`/`.tsx` or type annotations
- **No `throw new Error()`** in app/runtime code - use `AppError` / `ValidationError` from `@techstream/quark-core/errors`
- **No `console.log`** in app/runtime code - use `createLogger(name)` from `@techstream/quark-core`
- **Zod required** - all server actions and API routes validate with Zod
- **DB convention** - all models include `createdAt` and `updatedAt`
- **UI imports** - from `@techstream/quark-ui` (monorepo) or `@<scope>/ui` (scaffolded), no `@/components/ui/*`
- **Query pattern** - package functions receive `prisma` as parameter, no direct Prisma imports in package code
- **Scope rewriting** - `@techstream/quark-bookings` → `@<scope>/bookings` during scaffold

### Must Avoid

- Building a custom calendar library - use a lightweight date utility like `date-fns` for the `BookingCalendar` client component
- Embedding payment logic - price is stored as metadata only
- Supporting recurring bookings - deferred to v2
- Deep-coupling with CMS - bookings must work standalone even if CMS is not installed
- Modifying template files directly - templates are generated via `sync-templates`, edit source files only

---

## File Manifest (Estimated)

| Category | Files |
|---|---|
| Prisma schema (modified) | 1 |
| Core package files | 7 |
| Core package tests | 4 |
| Admin pages | 14 |
| Admin server actions | 4 |
| Admin client components | 6 |
| Public pages | 5 |
| Public client components | 6 |
| Email templates (modified) | 1 |
| Job definitions (modified) | 1 |
| Worker handlers | 2 |
| CLI index.js (modified) | 1 |
| CLI sync-templates.js (modified) | 1 |
| Admin layout (modified) | 1 |
| E2E / integration tests | 8 |
| **Total** | **~62 files** |
