---
name: ecommerce-cart
description: Shopping cart for Quark ecommerce. Use when building cart add/remove/update, session linking, or cart totals.
---

# Ecommerce Cart Skill

Build the shopping cart for an ecommerce system on Quark. This sub-skill covers the cart model, item operations, session linking, and total calculation.

## Context

The cart is a temporary collection of items a user intends to purchase. Key concerns:

- **Session-based or user-linked** — anonymous carts use a session ID; authenticated carts link to a user.
- **Add/remove/update** — atomic operations with stock validation.
- **Cart totals** — computed from item quantities and variant prices.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **Server Actions** use `"use server"`, Zod validation, and `AppError`/`ValidationError` from `@usequark/quark-core/errors`.
- **Auth** via `getCurrentSession` from `@usequark/quark-core`.

## Models

```prisma
model Cart {
  id        String     @id @default(cuid())
  userId    String?
  user      User?      @relation(fields: [userId], references: [id])
  sessionId String?    @unique
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([userId])
  @@index([sessionId])
}

model CartItem {
  id        String         @id @default(cuid())
  cartId    String
  cart      Cart           @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  quantity  Int            @default(1)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@unique([cartId, variantId])
}
```

## Query helpers

```js
// packages/db/src/queries.js additions

export async function getCartBySession(sessionId) {
  return prisma.cart.findUnique({
    where: { sessionId },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
}

export async function getCartByUser(userId) {
  return prisma.cart.findFirst({
    where: { userId },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
}

export async function getCartTotal(cartId) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: { variant: true },
  });
  return items.reduce((sum, item) => sum + Number(item.variant.price) * item.quantity, 0);
}
```

## Cart operations

### Adding to cart

Use a Prisma transaction to prevent race conditions. Check stock availability before adding.

```js
import { prisma } from "@__QUARK_SCOPE__/db";
import { AppError } from "@usequark/quark-core/errors";

export async function addToCart(cartId, variantId, quantity = 1) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new AppError("Variant not found", 404, "NOT_FOUND");

    const available = variant.stock - variant.reserved;
    if (available < quantity) {
      throw new AppError("Insufficient stock", 409, "OUT_OF_STOCK");
    }

    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
    });

    if (existing) {
      return tx.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    return tx.cartItem.create({
      data: { cartId, variantId, quantity },
    });
  });
}
```

### Updating quantity

```js
export async function updateCartItemQuantity(cartItemId, quantity) {
  if (quantity < 1) {
    return prisma.cartItem.delete({ where: { id: cartItemId } });
  }
  return prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
  });
}
```

### Removing from cart

```js
export async function removeFromCart(cartItemId) {
  return prisma.cartItem.delete({ where: { id: cartItemId } });
}
```

## Session linking

For anonymous users, create a cart with a random `sessionId` cookie. On login, merge the session cart into the user's cart:

```js
export async function mergeCarts(sessionId, userId) {
  const sessionCart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: true },
  });
  if (!sessionCart) return;

  let userCart = await prisma.cart.findFirst({ where: { userId } });
  if (!userCart) {
    userCart = await prisma.cart.create({ data: { userId } });
  }

  for (const item of sessionCart.items) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: userCart.id, variantId: item.variantId, quantity: item.quantity },
      });
    }
  }

  await prisma.cartItem.deleteMany({ where: { cartId: sessionCart.id } });
  await prisma.cart.delete({ where: { id: sessionCart.id } });
}
```

## Example validation schema

```js
const addToCartSchema = z.object({
  cartId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
});
```

## End result

A cart where users can add, remove, and update items — with stock validation, session merging on login, and computed totals ready for checkout.
