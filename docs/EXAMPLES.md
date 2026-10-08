# Domain Model Examples

Quark ships seven core models (`User`, `Account`, `Session`, `VerificationToken`, `Job`, `File`, `AuditLog`) and does **not** enforce domain models. Your project defines the models specific to your business logic, and they live in your own `db` package alongside the core ones.

This document provides reference patterns for common Quark use cases.

---

## Getting Started: Non-Interactive Project Creation

For development, CI/CD pipelines, or testing, you can create projects without interactive prompts. Passing any configuration option (`--packages`, `--signup`, `--prompt`, `--harness`) skips the prompts implicitly, so no `--no-prompts` flag is needed.

### Basic Setup

```bash
# Create project with defaults (jobs is the only optional feature on by default)
npx @usequark/quark-create-app my-app --packages jobs

# Navigate and set up
cd my-app
docker compose up -d
pnpm db:migrate
pnpm dev
```

### Automated Full Startup

```bash
# Create, install, and start everything
npx @usequark/quark-create-app my-app --packages jobs && \
cd my-app && \
docker compose up -d && \
pnpm db:migrate && \
pnpm dev
```

### Custom Feature Selection

`db`, `config`, and `ui` are always scaffolded, so `--packages` only selects the optional pieces: `jobs` and `pwa`. `mobile` is rejected at creation time and has to be added afterwards.

```bash
# Defaults: jobs (which pulls in the worker app), no PWA
npx @usequark/quark-create-app my-app --packages jobs

# Jobs plus an installable PWA
npx @usequark/quark-create-app my-app --packages jobs,pwa

# Minimal setup: no worker, no PWA
npx @usequark/quark-create-app my-app --packages ""
```

### CI/CD Pipeline Example

```bash
#!/bin/bash
# Create project without installation (install separately in CI)
npx @usequark/quark-create-app my-app \
  --packages jobs \
  --skip-install

cd my-app
pnpm install          # Separate dependency installation
pnpm lint             # Run linters
pnpm test             # Run tests
docker compose up -d  # Start services
pnpm db:migrate       # Apply migrations
pnpm db:seed          # Optional: seed database
```

### Adding Features Later

Optional features can be added to an existing project through the `add` subcommand, which accepts `ui`, `jobs`, `pwa`, or `mobile`. This is the only way to get the mobile app, since creation rejects it:

```bash
cd my-app
npx @usequark/quark-create-app add jobs
npx @usequark/quark-create-app add mobile
```

### Troubleshooting Non-Interactive Mode

If features don't install correctly:

```bash
# Verify feature names - valid options at creation time: jobs, pwa
npx @usequark/quark-create-app my-app --packages jobs

# db, config, and ui are always scaffolded; jobs and pwa are the optional picks
ls -la my-app/packages/

# Manually install if needed
cd my-app
pnpm install
```

For interactive mode with prompts, pass no options at all:

```bash
npx @usequark/quark-create-app my-app
```

---

## Pattern: Generic User-Generated Content

**Best for:** Blogs, CMS platforms, review sites, Q&A forums

A `Post` model is yours to define here. Quark's own schema has no `Post`; it was removed, along with the admin dashboard and auto-CRUD that once generated screens for it. Build the screens yourself.

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

Adding the relation means extending `User` too:

```prisma
model User {
  // ... existing fields ...

  posts Post[]
}
```

### Query Helpers

Add these to your scaffolded `db` package, next to the existing helpers in `packages/db/src/queries.js`. `prisma` and `USER_SAFE_SELECT` are already imported at the top of that file.

```javascript
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

Validation schemas live in `packages/db/src/schemas.js`, which already imports Zod.

```javascript
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

Routes go under `apps/web/src/app/api/`. `requireAuth` comes from `@/lib/auth-middleware`, `handleError` from the sibling `apps/web/src/app/api/error-handler.js`, and `requireAuth()` with no argument reads the session itself.

```javascript
// apps/web/src/app/api/posts/route.js

import { validateBody, withCsrfProtection } from "@usequark/quark-core";
import { post, postCreateSchema } from "@<scope>/db";
import { requireAuth } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";
import { handleError } from "../error-handler";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") ?? "0");
    const take = parseInt(searchParams.get("take") ?? "10");

    const posts = await post.findPublished({ skip, take });
    return NextResponse.json(posts);
  } catch (error) {
    return handleError(error);
  }
}

export const POST = withCsrfProtection(async (request) => {
  try {
    const session = await requireAuth();
    const data = await validateBody(request, postCreateSchema);

    const newPost = await post.create({
      ...data,
      authorId: session.user.id,
    });

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
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

Add these to your scaffolded `db` package, next to the existing helpers in `packages/db/src/queries.js`. `prisma` is already imported at the top of that file.

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

import { validateBody, withCsrfProtection } from "@usequark/quark-core";
import { contactInquiry } from "@<scope>/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../error-handler";

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(10),
});

export const POST = withCsrfProtection(async (request) => {
  try {
    const data = await validateBody(request, contactSchema);

    const inquiry = await contactInquiry.create({
      ...data,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
});
```

To notify your team by email, add a handler of your own rather than reusing a core job name. Register it in `apps/worker/src/handlers/index.js`, then enqueue it through `createQueue(JOB_QUEUES.EMAIL)` from `@<scope>/jobs`.

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
- Use cascading deletes for owned relationships (e.g., `User` to `Post`)
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

`USER_SAFE_SELECT` is already exported from `packages/db/src/queries.js`. Use it rather than spreading every field, so a sensitive column added later cannot leak by default.

```javascript
// Exclude sensitive fields when returning user data
export const USER_SAFE_SELECT = {
  id: true,
  email: true,
  emailVerified: true,
  name: true,
  image: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  // Never include: password
};
```

`user.findByEmail` is the deliberate exception: it returns every field, password included, because credential verification needs the hash. It is for internal auth only.

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

Five steps: model, query helper, validation schema, API route, migration.

### Step 1: Define the Model

`BlogComment` hangs off the domain `Post` model from the first chapter, so define that first.

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

Append to `packages/db/src/queries.js`, which already imports `prisma` and `USER_SAFE_SELECT`.

```javascript
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

Append to `packages/db/src/schemas.js`, which already imports Zod.

```javascript
export const blogCommentCreateSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1).max(5000),
});
```

### Step 4: Create API Route

The route sits two levels below `/api`, so `handleError` comes from `apps/web/src/app/api/error-handler.js` via `../../../error-handler`.

```javascript
// apps/web/src/app/api/posts/[id]/comments/route.js

import { validateBody, withCsrfProtection } from "@usequark/quark-core";
import { blogComment, blogCommentCreateSchema } from "@<scope>/db";
import { requireAuth } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";
import { handleError } from "../../../error-handler";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const comments = await blogComment.findByPost(id);
    return NextResponse.json(comments);
  } catch (error) {
    return handleError(error);
  }
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
