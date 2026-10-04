---
name: ecommerce
description: Build an ecommerce system on Quark. Use when the user wants products, catalog, cart, checkout, orders, inventory, or storefront.
---

# Ecommerce Skill

Build an ecommerce system on Quark's infrastructure. This skill gives you the domain context, the Quark framework patterns, and the end-result shape. You generate the code that fits the user's exact requirements.

## Context

An ecommerce system manages a product catalog, shopping cart, checkout flow, orders, and inventory. The core entities and concerns:

- **Product** — the sellable item with name, description, pricing, and images.
- **ProductVariant** — a specific option of a product (size, color, material) with its own SKU, price, and stock.
- **Category** — hierarchical grouping for browsing and filtering.
- **Cart** — a session-linked or user-linked collection of items before purchase.
- **Order** — a completed purchase with line items, shipping address, payment status, and fulfillment state.
- **Inventory** — stock levels, reserved vs. available counts, atomic decrement on order.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **Server Actions** (preferred for mutations) use `"use server"`, Zod validation, and `AppError`/`ValidationError` from `@usequark/quark-core/errors`.
- **Admin views** live under `apps/web/src/app/admin/` (see the admin-dashboard skill for product/order management).
- **Auth** via `getCurrentSession` from `@usequark/quark-core`.
- **Payment** integration follows the payment skill for Stripe Checkout or similar processors.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Clarify the user's requirements: product types, variants, categories, checkout flow, payment provider.
3. Design the Prisma models (Product, Variant, Category, Cart, CartItem, Order, OrderItem) and add query helpers.
4. Build the catalog endpoints: CRUD for products, variants, categories with admin guards.
5. Build the cart: session-based or user-linked, add/remove/update actions, cart total calculation.
6. Build checkout: address collection → shipping method → payment → order creation with inventory decrement.
7. Add tests near the changed code.

## Example: Prisma models

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

model Product {
  id          String          @id @default(cuid())
  name        String
  slug        String          @unique
  description String?         @db.Text
  basePrice   Decimal         @db.Decimal(10, 2)
  currency    String          @default("USD")
  images      String[]
  active      Boolean         @default(true)
  categoryId  String?
  category    Category?       @relation(fields: [categoryId], references: [id])
  variants    ProductVariant[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([slug])
  @@index([categoryId])
  @@index([active])
}

model ProductVariant {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku       String   @unique
  name      String
  price     Decimal  @db.Decimal(10, 2)
  stock     Int      @default(0)
  reserved  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([productId])
  @@index([sku])
}

model Category {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?   @db.Text
  parentId    String?
  parent      Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  products    Product[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([slug])
  @@index([parentId])
}

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

## Example: Zod validation

```js
import { z } from "zod";

export const addToCartSchema = z.object({
  cartId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
});

export const checkoutSchema = z.object({
  cartId: z.string().min(1),
  email: z.string().email(),
  shippingName: z.string().min(1),
  shippingAddress: z.string().min(1),
  shippingCity: z.string().min(1),
  shippingZip: z.string().min(1),
  shippingCountry: z.string().min(2).max(2),
});
```

## Sub-skills

The ecommerce domain is split into focused sub-skills. Load the one that matches your current task:

| Sub-skill | Path | Covers |
|---|---|---|
| ecommerce-catalog | `ecommerce-catalog/SKILL.md` | Product, variant, and category models + CRUD. |
| ecommerce-cart | `ecommerce-cart/SKILL.md` | Cart model, add/remove/update, session linking, totals. |
| ecommerce-checkout | `ecommerce-checkout/SKILL.md` | Checkout flow, order lifecycle, inventory, integration. |

## Integration points

### Admin dashboard

Use the admin-dashboard skill to build product management screens:
- `apps/web/src/app/admin/products/` — list, create, edit products and variants.
- `apps/web/src/app/admin/orders/` — list orders, update status, view details.
- `apps/web/src/app/admin/categories/` — manage category tree.

### Payment

Reference the payment skill for Stripe Checkout integration:
1. Create a Checkout Session with cart line items.
2. Store `stripeSessionId` on the Order.
3. Handle the `checkout.session.completed` webhook to transition to `PAID`.
4. Handle refunds via the Stripe API, transitioning to `REFUNDED`.

## End result

A working ecommerce system where users can browse a product catalog, add items to a cart, complete checkout with payment, and have orders tracked through a fulfillment lifecycle — with inventory management, admin screens, and Quark conventions throughout.
