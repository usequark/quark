# @techstream/quark-bookings

Booking system helpers for your Quark project.

Use this package when your project needs appointment booking, service scheduling, or any time-slot reservation system with availability tracking and booking lifecycle management.

## Use this package when

- users need to book time slots for services (lanes, appointments, classes, etc.)
- you need server-side availability management with atomic slot reservation
- you want a reusable state machine for booking lifecycles (pending, confirmed, cancelled, etc.)
- you need the booking form logic decoupled from your UI

## What it owns

- `src/config.js` - central booking configuration (scheduling, notifications, cancellation policy)
- `src/status.js` - booking status state machine (`canTransition`, `applyTransition`)
- `src/validation.js` - Zod schemas for booking, service type, slot, and cancellation validation
- `src/availability.js` - slot management (`getAvailableSlots`, `checkSlotAvailability`, `generateSlots`, `releaseSlot`)
- `src/queries.js` - core data operations (`createBooking`, `cancelBooking`, `confirmBooking`, `completeBooking`, `findBookings`)
- `src/use-booking.js` - React hook for booking form state management (**no UI dependency**)

## Quick start

### 1. Use the hook for your booking form

```javascript
// apps/web/src/app/book/_components/BookingForm.js
"use client";
import { useBooking } from "@techstream/quark-bookings";
import { Button } from "@techstream/quark-ui";

export default function BookingForm({ services, action }) {
  const booking = useBooking({ services, action });

  const {
    step, stepMeta, steps,
    selectedService, selectedDuration, selectedDate, selectedTime,
    errors, pending, submitted,
    durationMinutes, durationLabel,
    handleNext, handleBack, handleSubmit,
    setSelectedServiceId, setSelectedDuration, setSelectedDate, setSelectedTime,
    formatTimeDisplay, getEndTime,
  } = booking;

  return (
    <form onSubmit={handleSubmit}>
      <StepIndicator currentStep={step} steps={steps} />

      {step === 1 && (
        /* Your service selector UI - completely custom styling */
        <YourServiceSelector
          services={services}
          selectedId={booking.selectedServiceId}
          onSelect={setSelectedServiceId}
        />
      )}

      {step === 2 && (
        /* Your duration picker UI */
        <YourDurationPicker
          options={booking.durationOptions}
          selected={selectedDuration}
          onSelect={setSelectedDuration}
          service={selectedService}
        />
      )}

      {step === 3 && (
        /* Your date/time picker UI */
        <YourDateTimePicker
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onDateSelect={setSelectedDate}
          onTimeSelect={setSelectedTime}
          errors={errors}
        />
      )}

      {step === 4 && (
        /* Your customer details form. Pass `submitted` to show errors only after submit. */
        <YourCustomerForm errors={errors} submitted={submitted} />
      )}

      <div>
        {step > 1 && <button onClick={handleBack}>Back</button>}
        {step < steps.length ? (
          <button onClick={handleNext}>Next</button>
        ) : (
          <button type="submit" disabled={pending}>
            {pending ? "Booking..." : "Confirm Booking"}
          </button>
        )}
      </div>
    </form>
  );
}
```

### 2. Hook reference

`useBooking({ services, action })` returns:

| Property | Type | Description |
|---|---|---|
| `step` | `number` | Current step (1-4) |
| `steps` | `Array` | Step definitions (`[{num, label, title, desc}]`) |
| `stepMeta` | `object` | Current step's metadata |
| `selectedServiceId` | `string` | Selected service ID |
| `selectedService` | `object` | Full selected service object |
| `selectedDuration` | `string` | Selected duration (`"30"`, `"60"`, `"90"`, `"120"`) |
| `selectedDate` | `string` | Selected date (`"YYYY-MM-DD"`) |
| `selectedTime` | `string` | Selected start time (`"HH:MM"`) |
| `durationMinutes` | `number` | Duration in minutes |
| `durationLabel` | `string` | Human-readable duration |
| `durationOptions` | `Array` | Duration option objects |
| `errors` | `object` | Validation errors keyed by field name |
| `pending` | `boolean` | Form submission in progress |
| `submitted` | `boolean` | `true` after user clicks submit (use to gate error display) |
| `goToStep(n)` | `function` | Navigate to step `n` (clears errors and `submitted`) |
| `handleNext()` | `function` | Validate current step and go to next |
| `handleBack()` | `function` | Go to previous step |
| `handleSubmit(event)` | `function` | Submit the form |
| `setSelectedServiceId(id)` | `function` | Select a service |
| `setSelectedDuration(val)` | `function` | Set duration |
| `setSelectedDate(dateStr)` | `function` | Set date |
| `setSelectedTime(timeStr)` | `function` | Set time |
| `formatTimeDisplay(time24)` | `function` | Convert `"14:30"` to `"2:30 PM"` |
| `getEndTime(start, min)` | `function` | Calculate end time from start + duration |

### 3. Server action pattern

```javascript
// apps/web/src/app/book/_actions/book.js
"use server";
import { createBooking } from "@techstream/quark-bookings";
import { prisma } from "@techstream/quark-db";
import { redirect } from "next/navigation";
import { z } from "zod";

const formSchema = z.object({
  serviceTypeId: z.string().min(1, "Please select a service"),
  date: z.string().min(1, "Please select a date"),
  startTime: z.string().min(1, "Please select a start time"),
  duration: z.string().min(1, "Please select a duration"),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function bookLane(_prevState, formData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { serviceTypeId, date, startTime, duration, name, email, phone, notes } = parsed.data;
  const durationMinutes = Number.parseInt(duration, 10);

  // Build slot times from start + duration
  const slotTimes = getConsecutiveSlotTimes(startTime, durationMinutes);

  for (const slotTime of slotTimes) {
    const [h, m] = slotTime.split(":").map(Number);
    const slotStart = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    // Find or create availability slot
    let slot = await prisma.availabilitySlot.findFirst({
      where: { serviceId: serviceTypeId, startTime: slotStart, endTime: slotEnd, active: true },
    });

    if (!slot) {
      slot = await prisma.availabilitySlot.create({
        data: { serviceId: serviceTypeId, startTime: slotStart, endTime: slotEnd, capacity: 1 },
      });
    }

    if (slot.bookedCount >= slot.capacity) {
      return { errors: { startTime: ["Slot is fully booked"] } };
    }

    try {
      await createBooking({ prisma, data: { name, email, phone, notes, slotId: slot.id, serviceTypeId } });
    } catch (err) {
      if (err.code === "SLOT_FULL") {
        return { errors: { startTime: ["Slot is fully booked"] } };
      }
      throw err;
    }
  }

  redirect("/book?booked=true");
}
```

### 4. Customer form with delayed error display

Pass `submitted` to your customer form. Only show errors after the user has clicked "Confirm Booking":

```javascript
export default function CustomerForm({ errors, submitted }) {
  const showError = (field) => submitted && errors[field];

  return (
    <div>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" className={showError("name") ? "border-red-500" : ""} />
      {showError("name") && <p className="text-red-500">{errors.name[0]}</p>}
    </div>
  );
}
```

### 5. Config module

```javascript
import { bookingsConfig } from "@techstream/quark-bookings";

// Override scheduling, notifications, or cancellation policies
bookingsConfig.scheduling.slotInterval = 15; // 15-minute slots
bookingsConfig.public.maxBookingsPerSlot = 4; // 4 bookings per slot
```

### 6. Status transitions

```javascript
import { canTransition, applyTransition } from "@techstream/quark-bookings";

if (canTransition(booking.status, "CANCELLED")) {
  const patch = applyTransition(booking, "CANCELLED");
  // patch = { status: "CANCELLED", cancelledAt: Date }
}
```

Valid transitions: `PENDING → CONFIRMED`, `PENDING → CANCELLED`, `CONFIRMED → COMPLETED`, `CONFIRMED → CANCELLED`, `CONFIRMED → NO_SHOW`.

## Important boundary

The bookings package handles **state management and business logic**. You own the UI rendering. The hook provides all the state and handlers; your components decide how things look. This means you can use the same booking logic with any CSS framework, component library, or design system.

## Relationship to the admin package

Bookings builds on the same local-first philosophy:

- `admin` provides generic CRUD scaffolding
- `bookings` adds booking-specific workflows: availability management, slot generation, status lifecycle, and self-service cancellation
- If your project only needs simple CRUD, `admin` may be enough

## Database requirements

Requires the following Prisma models: `ServiceType`, `AvailabilitySlot`, `Booking`, `Staff`, `StaffService`. All are scaffolded automatically when you opt into bookings during project creation (`pnpm create quark --features bookings`).
