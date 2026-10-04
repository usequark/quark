---
name: ecommerce-catalog
description: Product catalog models and CRUD for Quark ecommerce. Use when managing products, variants, categories, or pricing.
---

# Ecommerce Catalog Skill

Manage the product catalog for an ecommerce system on Quark. This sub-skill covers product, variant, and category models plus CRUD operations.

## Context

The catalog is the foundation of an ecommerce system. It defines what you sell, how it's organized, and how it's priced.

- **Product** — the sellable item with name, description, pricing, and images.
- **ProductVariant** — a specific option of a product (size, color, material) with its own SKU, price, and stock.
- **Category** — hierarchical grouping for browsing and filtering.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **API routes** live in `apps/web/src/app/api/<resource>/`. Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`. Follow `apps/web/src/app/api/users/route.js` as the reference shape.
- **Server Actions** use `"use server"`, Zod validation, and `AppError`/`ValidationError` from `@usequark/quark-core/errors`.
- **Admin views** live under `apps/web/src/app/admin/products/` and `apps/web/src/app/admin/categories/`.

## Models

### Category

```prisma
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
```

### Product

```prisma
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
```

### ProductVariant

```prisma
model ProductVariant {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku       String   @unique
  name      String   // e.g. "Large / Blue"
  price     Decimal  @db.Decimal(10, 2)
  stock     Int      @default(0)
  reserved  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([productId])
  @@index([sku])
}
```

## Query helpers

```js
// packages/db/src/queries.js additions

export async function getProductBySlug(slug) {
  return prisma.product.findUnique({
    where: { slug },
    include: { category: true, variants: true },
  });
}

export async function listActiveProducts({ categoryId, limit = 20, offset = 0 } = {}) {
  const where = { active: true };
  if (categoryId) where.categoryId = categoryId;
  return prisma.product.findMany({
    where,
    include: { category: true, variants: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getCategoryTree() {
  return prisma.category.findMany({
    where: { parentId: null },
    include: { children: true, _count: { select: { products: true } } },
  });
}
```

## Admin CRUD actions

```js
"use server";
import { z } from "zod";
import { prisma } from "@__QUARK_SCOPE__/db";
import { ValidationError, AppError } from "@usequark/quark-core/errors";
import { createLogger } from "@usequark/quark-core";

const log = createLogger("action:product");

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  basePrice: z.coerce.number().positive(),
  categoryId: z.string().optional(),
  images: z.array(z.string().url()).optional(),
});

export async function createProduct(formData) {
  const parsed = createProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) throw new AppError("Slug already in use", 409, "CONFLICT");

  const product = await prisma.product.create({ data: parsed.data });
  log.info("product created", { id: product.id, slug: product.slug });
  return product;
}

const createVariantSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().nonnegative(),
});

export async function createVariant(formData) {
  const parsed = createVariantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const existing = await prisma.productVariant.findUnique({ where: { sku: parsed.data.sku } });
  if (existing) throw new AppError("SKU already in use", 409, "CONFLICT");

  const variant = await prisma.productVariant.create({ data: parsed.data });
  log.info("variant created", { id: variant.id, sku: variant.sku });
  return variant;
}
```

## End result

A catalog where admins can manage products, variants, and categories — with slug-based lookups, hierarchical categories, and query helpers for the storefront.
