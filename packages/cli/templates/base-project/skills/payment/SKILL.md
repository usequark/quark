---
name: payment
description: Stripe payment integration - checkout sessions, webhooks, customer management, and fulfillment. Use when building payment flows, checkout, subscriptions, or handling Stripe webhooks.
---

# Payment Skill

Build Stripe payment flows on Quark. This skill covers the full Stripe lifecycle: customer management, checkout sessions, webhook verification, and post-payment fulfillment.

## Domain context

Stripe integration lifecycle:

```
Customer → Checkout Session → Payment → Webhook → Fulfillment
```

Key concepts:
- **Stripe Customer** — persistent record of a payer; store the `stripeCustomerId` on your User model.
- **Checkout Session** — hosted payment page for one-time or subscription payments.
- **Webhook** — Stripe sends HTTP events to your server after payment events occur.
- **Fulfillment** — your server's response to a successful payment (update status, send email, grant access).
- **Idempotency** — webhook handler must be safe to retry; use `eventId` deduplication.

## Framework context

- **Stripe client** — `createStripeClient()` from `@usequark/quark-core/stripe`. Reads `STRIPE_SECRET_KEY` from env.
- **Webhook route** — `apps/web/src/app/api/stripe/webhook/route.js`. Use `getStripeWebhookEvent()` from `@usequark/quark-core/stripe` to verify signatures.
- **Validation** — Zod for all incoming data. Webhook event data is already validated by Stripe's SDK.
- **Errors** — `AppError` / `ValidationError` from `@usequark/quark-core/errors` for app errors. Never throw on webhook failures — return 200 to prevent Stripe retries for unfixable errors.
- **Logging** — `createLogger("stripe:webhook")` from `@usequark/quark-core`.
- **Models** — add `stripeCustomerId String?` to User, `stripeSessionId String?` / `stripeSubscriptionId String?` to relevant models. Every model needs `createdAt` / `updatedAt`.

## Checkout sessions

### Zod validation for checkout input

```js
import { z } from "zod";

export const checkoutSchema = z.object({
  priceId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
```

### One-time payment

```js
import { createStripeClient } from "@usequark/quark-core/stripe";

const stripe = await createStripeClient();
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  customer: stripeCustomerId, // or omit to create anonymous checkout
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/payment/cancel`,
  metadata: { orderId },
});
```

### Subscription

```js
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: stripeCustomerId,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/account?upgraded=true`,
  cancel_url: `${origin}/pricing`,
  metadata: { userId },
});
```

## Webhooks

### Webhook route handler

```js
// apps/web/src/app/api/stripe/webhook/route.js
import { NextResponse } from "next/server";
import { getStripeWebhookEvent } from "@usequark/quark-core/stripe";
import { createLogger } from "@usequark/quark-core";
import { prisma } from "@__QUARK_SCOPE__/db";

const log = createLogger("stripe:webhook");

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = await getStripeWebhookEvent(body, signature);
  } catch (err) {
    log.error("webhook signature verification failed", { error: err.message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  log.info("webhook received", { type: event.type, id: event.id });

  // Idempotency check — skip if already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true });
  }

  // Record event for idempotency
  await prisma.webhookEvent.create({
    data: {
      stripeEventId: event.id,
      type: event.type,
      payload: event,
    },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        log.info("unhandled event type", { type: event.type });
    }
  } catch (err) {
    log.error("webhook handler error", { type: event.type, error: err.message });
    // Return 200 to prevent Stripe retry for handler errors
    // Log and alert instead — retrying won't fix app bugs
  }

  return NextResponse.json({ received: true });
}
```

### Event verification

`await getStripeWebhookEvent(body, signature)` calls `stripe.webhooks.constructEvent()` under the hood. It reads `STRIPE_WEBHOOK_SECRET` from env and throws if the signature is invalid.

### Common events to handle

| Event | Use case |
|---|---|
| `checkout.session.completed` | Mark order/booking as paid, grant access |
| `invoice.paid` | Subscription renewal succeeded |
| `invoice.payment_failed` | Subscription payment failed, notify user |
| `customer.subscription.deleted` | Revoke access, update status |
| `charge.refunded` | Process refund, update order status |

### Idempotency

Use a `WebhookEvent` model to record processed event IDs. Check before processing to prevent duplicate fulfillment:

```prisma
model WebhookEvent {
  id             String   @id @default(cuid())
  stripeEventId  String   @unique
  type           String
  payload        Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([stripeEventId])
  @@index([type])
}
```

## Customer management

### Create or retrieve Stripe customer

```js
import { createStripeClient } from "@usequark/quark-core/stripe";

export async function getOrCreateStripeCustomer(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = await createStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
```

### User model additions

Add to your User model in Prisma schema:

```prisma
model User {
  // ... existing fields
  stripeCustomerId String?  @unique
}
```

## Integration patterns

### Booking deposits

Collect a deposit at booking time:

1. Create booking in `PENDING` status with `stripeSessionId`.
2. Redirect to Stripe Checkout.
3. On `checkout.session.completed` webhook: update booking to `CONFIRMED`.
4. On cancellation: refund via `stripe.refunds.create({ payment_intent })`.

### Ecommerce checkout

1. Create an Order model with `stripeSessionId` and status `PENDING`.
2. Checkout Session with line items from cart.
3. Webhook confirms payment → update Order to `PAID`, decrement inventory.
4. Handle `payment_failed` → notify user, keep order in `PENDING`.

## Testing

### Stripe test mode

- Use Stripe test keys (`sk_test_...`) in `.env` for development.
- Test card: `4242 4242 4242 4242` (any future expiry, any CVC).
- Stripe Dashboard → Developers → Webhooks → add `http://localhost:3000/api/stripe/webhook` for local testing.

### Webhook CLI

Install the Stripe CLI and forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a webhook signing secret (`whsec_...`) — add it to `.env` as `STRIPE_WEBHOOK_SECRET`.

### Test pattern

```js
import { test } from "node:test";
import assert from "node:assert";

test("handleCheckoutCompleted updates booking status", async () => {
  // Create a mock Stripe session object
  // Assert booking status changes from PENDING to CONFIRMED
});
```

## Workflow

1. Read `CLAUDE.md` and project conventions.
2. Add `stripe` dependency to the consuming app if not already present.
3. Set up env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
4. Create Stripe Customer ID field on User model (if customer management is needed).
5. Build checkout session creation (Server Action or API route).
6. Implement webhook route handler with signature verification and idempotency.
7. Add fulfillment logic (update models, send emails, grant access).
8. Test with Stripe CLI webhook forwarding and test card numbers.

## Reference

Stripe docs: https://docs.stripe.com

## End result

A working payment system where users can complete Stripe Checkout for one-time or subscription payments, webhooks verify signatures and deduplicate events via `WebhookEvent`, Stripe customers are created lazily and stored on the User model, and post-payment fulfillment (booking confirmation, order status, access grants) runs idempotently — all following Quark conventions.
