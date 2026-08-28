---
name: ecommerce-checkout
description: Checkout flow, order lifecycle, and inventory management for Quark ecommerce. Use when building checkout, orders, payments, fulfillment, or stock management.
---

# Ecommerce Checkout Skill

Build the checkout flow, order lifecycle, and inventory management for an ecommerce system on Quark.

## Models

```prisma
enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  FULFILLED
  DELIVERED
  REFUNDED
  CANCELLED
}

model Order {
  id              String      @id @default(cuid())
  userId          String?
  user            User?       @relation(fields: [userId], references: [id])
  status          OrderStatus @default(PENDING)
  email           String
  shippingName    String
  shippingAddress String    @db.Text
  shippingCity    String
  shippingZip     String
  shippingCountry String
  total           Decimal     @db.Decimal(10, 2)
  currency        String      @default("USD")
  stripeSessionId String?     @unique
  paidAt          DateTime?
  fulfilledAt     DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  items           OrderItem[]

  @@index([userId, status])
  @@index([status])
  @@index([stripeSessionId])
  @@index([createdAt])
}

model OrderItem {
  id        String         @id @default(cuid())
  orderId   String
  order     Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  quantity  Int
  unitPrice Decimal        @db.Decimal(10, 2)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@index([orderId])
}
```

## Checkout action

```js
"use server";
import { z } from "zod";
import { prisma } from "@__QUARK_SCOPE__/db";
import { AppError, ValidationError } from "@techstream/quark-core/errors";
import { createLogger } from "@techstream/quark-core";

const log = createLogger("action:checkout");

const checkoutSchema = z.object({
  cartId: z.string().min(1),
  email: z.string().email(),
  shippingName: z.string().min(1),
  shippingAddress: z.string().min(1),
  shippingCity: z.string().min(1),
  shippingZip: z.string().min(1),
  shippingCountry: z.string().min(2).max(2),
});

export async function createOrder(formData) {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const { cartId } = parsed.data;

  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { variant: true } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }

    for (const item of cart.items) {
      const updated = await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.stock < 0) {
        throw new AppError(`Out of stock: ${item.variant.name}`, 409, "OUT_OF_STOCK");
      }
    }

    const total = cart.items.reduce(
      (sum, item) => sum + Number(item.variant.price) * item.quantity, 0
    );

    const order = await tx.order.create({
      data: {
        ...parsed.data,
        total,
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variant.price,
          })),
        },
      },
    });

    await tx.cartItem.deleteMany({ where: { cartId } });
    log.info("order created", { orderId: order.id, total });
    return order;
  });

  return order;
}
```

## Order lifecycle

```
PENDING → PAID (payment webhook)
PAID → PROCESSING (admin starts fulfillment)
PROCESSING → FULFILLED (admin ships)
FULFILLED → DELIVERED (carrier/admin)
PAID/PROCESSING/FULFILLED → REFUNDED
Any → CANCELLED (before fulfillment, admin only)
```

```js
const ORDER_TRANSITIONS = {
  PENDING:     ["PAID", "CANCELLED"],
  PAID:        ["PROCESSING", "REFUNDED", "CANCELLED"],
  PROCESSING:  ["FULFILLED", "REFUNDED"],
  FULFILLED:   ["DELIVERED", "REFUNDED"],
  DELIVERED:   ["REFUNDED"],
  REFUNDED:    [],
  CANCELLED:   [],
};

export function canTransitionOrder(from, to) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function applyOrderTransition(order, newStatus, opts = {}) {
  if (!canTransitionOrder(order.status, newStatus)) {
    throw new ValidationError(`Cannot transition from ${order.status} to ${newStatus}`);
  }
  const data = { status: newStatus };
  if (newStatus === "PAID") data.paidAt = new Date();
  if (newStatus === "FULFILLED") data.fulfilledAt = new Date();
  if (newStatus === "DELIVERED") data.deliveredAt = new Date();
  return data;
}
```

## Inventory management

Each `ProductVariant` tracks `stock` (total) and `reserved` (pending orders). **Available** = `stock - reserved`. Use atomic decrement in a transaction to prevent overselling.

Optional reserve/release pattern:

```js
// Reserve on cart add
await tx.productVariant.update({ where: { id: variantId }, data: { reserved: { increment: qty } } });
// Release on cart abandon/cancel
await tx.productVariant.update({ where: { id: variantId }, data: { reserved: { decrement: qty } } });
```

## Payment integration

Reference the payment skill for Stripe Checkout:
1. Create a Checkout Session with cart line items.
2. Store `stripeSessionId` on the Order.
3. Handle `checkout.session.completed` webhook → transition to `PAID`.
4. Handle refunds via Stripe API → transition to `REFUNDED`.
