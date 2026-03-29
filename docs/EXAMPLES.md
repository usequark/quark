# Domain Model Examples

Quark provides core infrastructure models (User, Auth, Files, Jobs, Audit Logs) but **does not enforce domain models**. Your project should define models specific to your business logic.

This document provides reference patterns for common Quark use cases.

---

## Getting Started: Non-Interactive Project Creation

For development, CI/CD pipelines, or testing, you can create projects without interactive prompts:

### Basic Non-Interactive Setup

```bash
# Create project with defaults (includes ui, jobs packages)
npx @techstream/quark-create-app my-app --no-prompts

# Navigate and set up
cd my-app
docker compose up -d
pnpm db:migrate
pnpm dev
```

### Automated Full Startup

```bash
# Create, install, and start everything
npx @techstream/quark-create-app my-app --no-prompts && \
cd my-app && \
docker compose up -d && \
pnpm db:migrate && \
pnpm dev
```

### Custom Feature Selection

```bash
# Create with only UI package (no jobs)
npx @techstream/quark-create-app my-app --no-prompts --features ui

# Create with only Jobs package (no UI)
npx @techstream/quark-create-app my-app --no-prompts --features jobs

# Minimal setup (no optional packages)
npx @techstream/quark-create-app my-app --no-prompts --features ""
```

### CI/CD Pipeline Example

```bash
#!/bin/bash
# Create project without installation (install separately in CI)
npx @techstream/quark-create-app my-app \
  --no-prompts \
  --features ui,jobs \
  --skip-install

cd my-app
pnpm install          # Separate dependency installation
pnpm lint             # Run linters
pnpm test             # Run tests
docker compose up -d  # Start services
pnpm db:migrate       # Apply migrations
pnpm db:seed          # Optional: seed database
```

### Troubleshooting Non-Interactive Mode

If features don't install correctly:

```bash
# Verify feature names - valid options: ui, jobs
npx @techstream/quark-create-app my-app --no-prompts --features ui,jobs

# Check that paths are created
ls -la my-app/packages/

# Manually install if needed
cd my-app
pnpm install
```

For interactive mode with prompts, simply omit the `--no-prompts` flag:

```bash
npx @techstream/quark-create-app my-app
```

---

## Pattern: Generic User-Generated Content

**Best for:** Blogs, CMS platforms, review sites, Q&A forums

### Model Definition

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String   @db.Text
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@index([published])
  @@index([createdAt])
}
```

### Query Helpers

```javascript
// packages/db/src/queries.js

const AUTHOR_SAFE_INCLUDE = { author: { select: USER_SAFE_SELECT } };

export const post = {
  findById: (id) => {
    return prisma.post.findUnique({
      where: { id },
      include: AUTHOR_SAFE_INCLUDE,
    });
  },
  findAll: (options = {}) => {
    const { skip = 0, take = 10, where, orderBy } = options;
    return prisma.post.findMany({
      where,
      skip,
      take,
      include: AUTHOR_SAFE_INCLUDE,
      orderBy: orderBy || { createdAt: "desc" },
    });
  },
  findPublished: (options = {}) => {
    const { skip = 0, take = 10 } = options;
    return prisma.post.findMany({
      where: { published: true },
      skip,
      take,
      include: AUTHOR_SAFE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  },
  findByAuthor: (authorId, options = {}) => {
    const { skip = 0, take = 10 } = options;
    return prisma.post.findMany({
      where: { authorId },
      skip,
      take,
      include: AUTHOR_SAFE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  },
  create: (data) => {
    return prisma.post.create({
      data,
      include: AUTHOR_SAFE_INCLUDE,
    });
  },
  update: (id, data) => {
    return prisma.post.update({
      where: { id },
      data,
      include: AUTHOR_SAFE_INCLUDE,
    });
  },
  delete: (id) => {
    return prisma.post.delete({
      where: { id },
    });
  },
};
```

### Validation Schema

```javascript
// packages/db/src/schemas.js

export const postCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  published: z.boolean().optional(),
});

export const postUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  content: z.string().optional(),
  published: z.boolean().optional(),
});
```

### API Routes

```javascript
// apps/web/src/app/api/posts/route.js

import { post, postCreateSchema } from "@techstream/quark-db";
import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { NextResponse } from "next/server";

export const GET = async (request) => {
  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get("skip") ?? "0");
  const take = parseInt(searchParams.get("take") ?? "10");

  const posts = await post.findPublished({ skip, take });
  return NextResponse.json(posts);
};

export const POST = withCsrfProtection(async (request) => {
  const session = await requireAuth();
  const data = await validateBody(request, postCreateSchema);

  const newPost = await post.create({
    ...data,
    authorId: session.user.id,
  });

  return NextResponse.json(newPost, { status: 201 });
});
```

---

## Pattern: E-Commerce Product Catalog

**Best for:** Online stores, marketplaces, SaaS product pages

### Model Definition

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  sku         String   @unique
  price       Decimal  @db.Decimal(10, 2)
  inventory   Int      @default(0)
  published   Boolean  @default(false)
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orderItems  OrderItem[]

  @@index([categoryId])
  @@index([published])
  @@index([sku])
  @@index([createdAt])
}

model Category {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  products Product[]

  @@index([slug])
}

model Order {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status    OrderStatus @default(PENDING)
  total     Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items OrderItem[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model OrderItem {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  quantity  Int
  price     Decimal  @db.Decimal(10, 2)

  @@unique([orderId, productId])
  @@index([orderId])
  @@index([productId])
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}
```

---

## Pattern: Contact Form Submissions

**Best for:** Brochure websites, lead generation, support inquiries

### Model Definition

```prisma
model ContactInquiry {
  id           String               @id @default(cuid())
  name         String
  email        String
  message      String               @db.Text
  status       ContactInquiryStatus @default(NEW)
  source       String?              // "website", "email", etc.
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@index([status])
  @@index([email])
  @@index([createdAt])
}

enum ContactInquiryStatus {
  NEW
  TRIAGED
  RESPONDED
  CLOSED
}
```

### Query Helpers

```javascript
export const contactInquiry = {
  findAll: (options = {}) => {
    const { skip = 0, take = 50, status } = options;
    return prisma.contactInquiry.findMany({
      where: status ? { status } : {},
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  },
  findById: (id) => {
    return prisma.contactInquiry.findUnique({
      where: { id },
    });
  },
  create: (data) => {
    return prisma.contactInquiry.create({
      data,
    });
  },
  updateStatus: (id, status) => {
    return prisma.contactInquiry.update({
      where: { id },
      data: { status },
    });
  },
  delete: (id) => {
    return prisma.contactInquiry.delete({
      where: { id },
    });
  },
};
```

### API Route

```javascript
// apps/web/src/app/api/contact/route.js

import { contactInquiry } from "@techstream/quark-db";
import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(10),
});

export const POST = withCsrfProtection(async (request) => {
  const data = await validateBody(request, contactSchema);

  const inquiry = await contactInquiry.create({
    ...data,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  // Send email notification to admins
  await queue.add("send-contact-notification", { inquiryId: inquiry.id });

  return NextResponse.json({ success: true }, { status: 201 });
});
```

---

## Pattern: SaaS Workspace & Team Management

**Best for:** Multi-tenant apps, collaborative tools, project management

### Model Definition

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  ownerId   String
  owner     User     @relation("owned", fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members WorkspaceMember[]

  @@index([ownerId])
  @@index([slug])
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation("member", fields: [userId], references: [id], onDelete: Cascade)
  role        String   @default("editor") // "admin", "editor", "viewer"
  createdAt   DateTime @default(now())

  @@unique([workspaceId, userId])
  @@index([workspaceId])
  @@index([userId])
}
```

### Update User Model

```prisma
model User {
  // ... existing fields ...

  owned      Workspace[]       @relation("owned")
  memberships WorkspaceMember[] @relation("member")
}
```

---

## Best Practices for Domain Models

### 1. Follow Quark Conventions

- Always include `createdAt` and `updatedAt` on every model
- Use CUID for primary keys: `@id @default(cuid())`
- Add indexes for: foreign keys, frequently filtered fields, sort fields
- Use cascading deletes for owned relationships (e.g., User → Posts)
- Use `SetNull` for optional relationships or preserve orphaned records

### 2. Create Query Helpers

```javascript
// Encapsulate database access patterns
export const myModel = {
  findById: (id) => { /* ... */ },
  findAll: (options = {}) => { /* ... */ },
  create: (data) => { /* ... */ },
  update: (id, data) => { /* ... */ },
  delete: (id) => { /* ... */ },
  // Domain-specific queries
  findByStatus: (status, options = {}) => { /* ... */ },
};
```

### 3. Validate Input with Zod

```javascript
// Always validate Server Actions and API routes
export const myModelCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
```

### 4. Use Safe Selects for Client Data

```javascript
// Exclude sensitive fields when returning user data
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  // Never include: password
};
```

### 5. Add Migrations

```bash
# After modifying schema.prisma
pnpm db:migrate --name add_my_model

# Keep migration history clean
git add packages/db/prisma/migrations
git commit -m "chore: add my_model migration"
```

---

## Reference: Adding a Complete Feature

### Step 1: Define the Model

```prisma
// packages/db/prisma/schema.prisma

model BlogComment {
  id      String   @id @default(cuid())
  postId  String
  userId  String
  content String   @db.Text
  approved Boolean @default(false)

  post      Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  author    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([postId, userId, createdAt]) // Prevent duplicate comments
  @@index([postId])
  @@index([userId])
  @@index([approved])
}
```

### Step 2: Create Query Helpers

```javascript
// packages/db/src/queries.js

export const blogComment = {
  findByPost: (postId, options = {}) => {
    const { skip = 0, take = 20 } = options;
    return prisma.blogComment.findMany({
      where: { postId, approved: true },
      skip,
      take,
      include: { author: { select: USER_SAFE_SELECT } },
      orderBy: { createdAt: "desc" },
    });
  },
  create: (data) => {
    return prisma.blogComment.create({
      data,
      include: { author: { select: USER_SAFE_SELECT } },
    });
  },
  approve: (id) => {
    return prisma.blogComment.update({
      where: { id },
      data: { approved: true },
    });
  },
  delete: (id) => {
    return prisma.blogComment.delete({ where: { id } });
  },
};
```

### Step 3: Create Validation Schema

```javascript
// packages/db/src/schemas.js

export const blogCommentCreateSchema = z.object({
  postId: z.string().cuid(),
  content: z.string().min(1).max(5000),
});
```

### Step 4: Create API Route

```javascript
// apps/web/src/app/api/posts/[id]/comments/route.js

import { blogComment, blogCommentCreateSchema } from "@techstream/quark-db";
import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";
import { NextResponse } from "next/server";

export async function GET(_request, { params }) {
  const { id } = await params;
  const comments = await blogComment.findByPost(id);
  return NextResponse.json(comments);
}

export const POST = withCsrfProtection(async (request, { params }) => {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = await validateBody(request, blogCommentCreateSchema);

    const comment = await blogComment.create({
      ...data,
      postId: id,
      userId: session.user.id,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
});
```

### Step 5: Run Migration

```bash
pnpm db:migrate --name add_blog_comments
```

Done! Your feature is now fully integrated with Quark's patterns.

---

## Extending Admin for Domain Models

When you add domain models to your Prisma schema, the admin auto-generates full CRUD (list, create, edit, delete) with search, pagination, and status badges. Most models work out of the box. For complex models that need domain-specific UI, you replace individual pages.

### Tier 1: Configuration (No Code)

Use `adminConfig.modelOverrides` for simple per-model customization:

```javascript
// packages/admin/src/config.js
export const adminConfig = {
  title: "Store Admin",
  pageSize: 25,
  modelOverrides: {
    // NextAuth internals (default)
    Account: { readOnly: true },
    Session: { readOnly: true },
    VerificationToken: { readOnly: true },
    AuditLog: { readOnly: true },
    // Domain models
    Product: { label: "Products" },
    Order: { label: "Orders" },
    OrderItem: { readOnly: true, label: "Line Items" },
    Payment: { readOnly: true },
    User: { hiddenFields: ["hashedPassword"] },
  },
};
```

**What this controls:**
- `readOnly` — disables create/edit/delete, groups model under "System" in sidebar
- `label` — display name in sidebar and headings
- `hiddenFields` — fields excluded from forms and tables

### Tier 2: Replace Model Pages (Custom Detail/Form)

When the generic form or list isn't enough for a specific model, replace that model's page file. The admin route structure uses Next.js catch-all patterns:

```
apps/web/src/app/admin/
  [model]/page.js          ← list view (auto-generated)
  [model]/[id]/page.js     ← detail/edit form (auto-generated)
  [model]/new/page.js      ← create form (auto-generated)
```

To customize a specific model, create a named route that takes priority over the dynamic `[model]` route:

```
apps/web/src/app/admin/
  order/page.js            ← custom order list (overrides [model] for orders)
  order/[id]/page.js       ← custom order detail (overrides [model]/[id])
  [model]/page.js          ← generic list for everything else
```

#### Example: Custom Order Detail Page

The generic edit form shows flat fields. An order needs line items, customer info, and status workflow buttons:

```javascript
// apps/web/src/app/admin/order/[id]/page.js
import { prisma } from "@yourapp/db";
import { Badge, Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@yourapp/ui";
import { notFound } from "next/navigation";
import { updateOrderStatus } from "./_actions";

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) notFound();

  const STATUS_VARIANTS = {
    PENDING: "warning", CONFIRMED: "info", SHIPPED: "info",
    DELIVERED: "success", CANCELLED: "default", REFUNDED: "danger",
  };
  const NEXT_STATUS = {
    PENDING: "CONFIRMED", CONFIRMED: "SHIPPED",
    SHIPPED: "DELIVERED",
  };
  const next = NEXT_STATUS[order.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Order {order.id.slice(-8)}</h1>
          <p className="text-sm text-text-faint mt-1">
            {order.customer.name} · {order.customer.email}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[order.status]}>{order.status}</Badge>
      </div>

      {/* Line items */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">${Number(item.price).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${(Number(item.price) * item.quantity).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end pt-4 border-t border-border mt-4">
            <p className="text-lg font-bold tabular-nums text-text">
              Total: ${Number(order.total).toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status actions */}
      {next && (
        <form action={updateOrderStatus}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="status" value={next} />
          <Button type="submit">Mark as {next}</Button>
        </form>
      )}
    </div>
  );
}
```

```javascript
// apps/web/src/app/admin/order/[id]/_actions.js
"use server";
import { prisma } from "@yourapp/db";
import { revalidatePath } from "next/cache";
import { requireRole } from "@techstream/quark-core/auth";

export async function updateOrderStatus(formData) {
  await requireRole("admin");
  const id = formData.get("id");
  const status = formData.get("status");
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/order/${id}`);
}
```

#### Example: Custom Form with Relation Dropdowns

The generic form can't render relation fields as dropdowns. Build a custom create page when a model has required relations:

```javascript
// apps/web/src/app/admin/booking/new/page.js
import { prisma } from "@yourapp/db";
import { Button, Input, Label, Select } from "@yourapp/ui";
import { createBooking } from "./_actions";

export default async function NewBookingPage() {
  const [services, staff, customers] = await Promise.all([
    prisma.service.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ include: { user: { select: { name: true } } } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">New Booking</h1>
      <form action={createBooking} className="space-y-4 max-w-lg">
        <div>
          <Label htmlFor="serviceId">Service</Label>
          <Select name="serviceId" required>
            <option value="">Select a service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — ${Number(s.price).toFixed(2)}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="staffId">Staff</Label>
          <Select name="staffId">
            <option value="">Any available</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.user.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="customerId">Customer</Label>
          <Select name="customerId" required>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startTime">Start</Label>
            <Input type="datetime-local" name="startTime" required />
          </div>
          <div>
            <Label htmlFor="endTime">End</Label>
            <Input type="datetime-local" name="endTime" required />
          </div>
        </div>
        <Button type="submit">Create Booking</Button>
      </form>
    </div>
  );
}
```

### Tier 3: Add Custom Pages and Dashboard Sections

For views that don't map to a single model (analytics, calendars, overviews), add new routes under `/admin` and link them from the sidebar.

#### Example: Low Stock Dashboard Section

Edit the existing dashboard to add domain-specific metrics:

```javascript
// apps/web/src/app/admin/page.js — add to the existing dashboard

// In the data fetching section, add:
const lowStock = await prisma.product.findMany({
  where: { stock: { lt: 10 }, status: "ACTIVE" },
  orderBy: { stock: "asc" },
  take: 10,
  select: { id: true, name: true, sku: true, stock: true },
});

// In the JSX, add a section:
<section>
  <h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint mb-3">
    Low Stock Alerts
  </h2>
  <Card>
    <CardContent className="pt-6">
      {lowStock.length === 0 ? (
        <p className="text-sm text-text-faint text-center py-4">All products well stocked</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lowStock.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={p.stock === 0 ? "danger" : "warning"}>{p.stock}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
</section>
```

#### Example: Custom Sidebar Links

To add a non-model page to the sidebar, edit `Sidebar.js` directly. Add your link between the Dashboard and the model sections:

```javascript
// apps/web/src/app/admin/_components/Sidebar.js — in the nav section after Dashboard

{navLink("/admin/calendar", "Calendar", /* your SVG icon */)}
{navLink("/admin/analytics", "Analytics", /* your SVG icon */)}
```

Then create the corresponding route file:

```javascript
// apps/web/src/app/admin/calendar/page.js
export default async function CalendarPage() {
  // Query bookings, render calendar grid
}
```

### Admin Extension Summary

| Level | When to use | What you change | Examples |
|-------|------------|-----------------|---------|
| **Config** | Simple model customization | `adminConfig.modelOverrides` | Labels, hidden fields, read-only |
| **Replace** | Model needs domain-specific UI | Named route overrides `[model]` | Order detail, booking form |
| **Add** | Non-model views, custom metrics | New routes + sidebar links | Calendar, analytics, stock alerts |

The generic CRUD handles 80% of models. Custom pages handle the rest. You never build an admin framework — you build Next.js pages that happen to live under `/admin`.

