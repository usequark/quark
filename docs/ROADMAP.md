# Quark Monorepo Expansion Roadmap

## Executive Summary

This document outlines a comprehensive plan to expand the Quark monorepo based on the current architecture analysis and the following requirements:

1. **UI Playground** - Interactive testing environment for UI components
2. **Worker Playground** - Testing environment for job queue features
3. **Enhanced Prisma Schema** - Consider schema separation via sharding/multi-schema approach
4. **Expanded Package Code** - More robust config, db, jobs, and ui implementations
5. **Full NextAuth Implementation** - Production-ready authentication with multiple providers

---

## Current State Analysis

### Existing Structure

```
quark/
├── apps/
│   ├── web/          # Next.js application (basic NextAuth setup)
│   └── worker/       # BullMQ worker (single email queue)
├── packages/
│   ├── config/       # Minimal config (appName only)
│   ├── db/           # Prisma with User/Post models
│   ├── jobs/         # Single email queue definition
│   └── ui/           # Single Button component
└── docs/             # API documentation
```

### Current Capabilities

| Package | Status | Completeness |
|---------|--------|--------------|
| `@techstream/quark-config` | ⚠️ Minimal | ~10% - Only `appName` defined |
| `@techstream/quark-db` | ⚠️ Basic | ~25% - Basic User/Post models, no auth tables |
| `@techstream/quark-jobs` | ⚠️ Basic | ~15% - Single email queue |
| `@techstream/quark-ui` | ⚠️ Basic | ~10% - Single Button component |
| `apps/web` | ⚠️ Basic | ~20% - Stub NextAuth with credentials only |
| `apps/worker` | ✅ Functional | ~40% - Working BullMQ worker |

### Infrastructure (docker-compose)

- ✅ PostgreSQL 16
- ✅ Redis 7
- ✅ Mailpit (SMTP testing)

---

## Proposed Architecture

### New Directory Structure

```
quark/
├── apps/
│   ├── web/                    # Main Next.js application
│   ├── worker/                 # BullMQ worker process
│   ├── ui-playground/          # NEW: Storybook or custom playground
│   └── worker-playground/      # NEW: Job queue testing UI
├── packages/
│   ├── config/                 # Enhanced configuration
│   ├── db/                     # Enhanced Prisma setup
│   │   └── prisma/
│   │       ├── schema.prisma         # Core schema (auth, base models)
│   │       └── schema/               # OR: Multi-file approach
│   │           ├── auth.prisma
│   │           ├── core.prisma
│   │           └── project.prisma    # Project-specific models
│   ├── jobs/                   # Enhanced job definitions
│   ├── ui/                     # Expanded component library
│   ├── auth/                   # NEW: Shared auth utilities
│   ├── email/                  # NEW: Email templates & sending
│   └── validators/             # NEW: Shared Zod schemas
└── docs/
    ├── API.md
    ├── ROADMAP.md              # This document
    └── ARCHITECTURE.md         # NEW: Architecture decisions
```

---

## Phase 1: UI Playground (Priority: High)

### Recommendation: Storybook

**Why Storybook over custom solution?**
- Industry standard for component development
- Built-in accessibility testing
- Visual regression testing support
- Automatic documentation generation
- Hot module reloading
- Addons ecosystem (controls, actions, viewports)

### Implementation Plan

#### 1.1 Create `apps/ui-playground`

```bash
# From monorepo root
pnpm create storybook@latest apps/ui-playground --type react
```

#### 1.2 Package Structure

```
apps/ui-playground/
├── .storybook/
│   ├── main.ts           # Storybook config
│   ├── preview.ts        # Global decorators
│   └── theme.ts          # Custom theme
├── package.json
├── tsconfig.json
└── src/
    └── stories/          # Story files (can also co-locate with components)
```

#### 1.3 Key Configuration

**`.storybook/main.ts`:**
```typescript
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],
  framework: "@storybook/react-vite",
};
export default config;
```

#### 1.4 Component Story Pattern

Each UI component should have a co-located story:

```
packages/ui/src/
├── button.tsx
├── button.test.tsx
├── button.stories.tsx    # NEW
├── input.tsx             # NEW
├── input.test.tsx        # NEW
└── input.stories.tsx     # NEW
```

#### 1.5 Scripts to Add

**Root `package.json`:**
```json
{
  "scripts": {
    "storybook": "turbo run storybook",
    "storybook:build": "turbo run storybook:build"
  }
}
```

**`turbo.json`:**
```json
{
  "tasks": {
    "storybook": {
      "cache": false,
      "persistent": true
    },
    "storybook:build": {
      "outputs": ["storybook-static/**"]
    }
  }
}
```

### Estimated Effort: 2-3 days

---

## Phase 2: Worker Playground (Priority: High)

### Recommendation: Custom Dashboard App

**Why custom over Bull Board?**
- Bull Board is great for monitoring, but we need a **testing** playground
- Custom allows job creation with form inputs
- Can integrate with our type definitions
- Better developer experience for testing job payloads

### Implementation Plan

#### 2.1 Create `apps/worker-playground`

A minimal Next.js or Vite app with:
- Job queue dashboard (using Bull Board embedded)
- Job creation forms (typed to our job definitions)
- Real-time job status monitoring
- Redis connection status

#### 2.2 Package Structure

```
apps/worker-playground/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── JobCreator.tsx      # Form to create jobs
    │   ├── QueueMonitor.tsx    # Real-time queue status
    │   └── JobHistory.tsx      # Past job results
    └── lib/
        └── queue-client.ts     # Queue connection
```

#### 2.3 Key Features

```typescript
// Job Creator with type safety
import { JOB_QUEUES, JOB_NAMES, EmailJobData } from "@techstream/quark-jobs";

function EmailJobCreator() {
  const [formData, setFormData] = useState<EmailJobData>({
    to: "",
    subject: "",
    body: "",
  });
  
  const createJob = async () => {
    await fetch("/api/jobs/create", {
      method: "POST",
      body: JSON.stringify({
        queue: JOB_QUEUES.EMAIL,
        name: JOB_NAMES.SEND_WELCOME_EMAIL,
        data: formData,
      }),
    });
  };
  
  return (/* form UI */);
}
```

#### 2.4 Bull Board Integration

```typescript
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
```

### Alternative: Standalone Bull Board

If a full playground is overkill initially, start with Bull Board:

```bash
pnpm add @bull-board/api @bull-board/express
```

### Estimated Effort: 3-4 days

---

## Phase 3: Prisma Schema Architecture (Priority: High)

### The Shard Question

> "Should we use shard to better separate monorepo from project data types?"

### Recommendation: Multi-File Schema (Not Database Sharding)

**Clarification:**
- **Database Sharding** = Splitting data across multiple database instances (complex, for scale)
- **Schema Organization** = Splitting Prisma schema into multiple files (organizational, recommended)

For a monorepo, you want **schema organization**, not database sharding.

### Option A: Prisma Multi-File Schema (Recommended)

Prisma supports `prismaSchemaFolder` preview feature:

```
packages/db/prisma/schema/
├── main.prisma          # Generator & datasource config
├── auth.prisma          # Auth-related models (User, Account, Session)
├── core.prisma          # Core business models
└── project.prisma       # Project-specific models
```

**`main.prisma`:**
```prisma
generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**`auth.prisma`:**
```prisma
// NextAuth.js required models
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  posts         Post[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**`core.prisma`:**
```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Option B: Single Schema with Clear Sections

If multi-file feels like overkill:

```prisma
// ============================================
// GENERATOR & DATASOURCE
// ============================================

generator client { ... }
datasource db { ... }

// ============================================
// AUTH MODELS (NextAuth.js)
// ============================================

model User { ... }
model Account { ... }
model Session { ... }
model VerificationToken { ... }

// ============================================
// CORE BUSINESS MODELS
// ============================================

model Post { ... }
model Comment { ... }

// ============================================
// PROJECT-SPECIFIC MODELS
// ============================================

model Project { ... }
model Task { ... }
```

### Option C: Separate Packages (For Large Teams)

For very large projects with distinct bounded contexts:

```
packages/
├── db-auth/           # @techstream/quark-db-auth
│   └── prisma/
│       └── schema.prisma
├── db-content/        # @techstream/quark-db-content
│   └── prisma/
│       └── schema.prisma
└── db/                # @techstream/quark-db (aggregates all)
```

**Not recommended** unless you have 50+ models and multiple teams.

### Recommendation Summary

| Team Size | Model Count | Recommendation |
|-----------|-------------|----------------|
| 1-5 devs  | < 20 models | Option B (single file, clear sections) |
| 5-15 devs | 20-50 models | Option A (multi-file schema) |
| 15+ devs  | 50+ models | Option C (separate packages) |

### Estimated Effort: 1-2 days

---

## Phase 4: Expanded Package Code (Priority: Medium)

### 4.1 Enhanced `@techstream/quark-config`

```typescript
// packages/config/src/index.ts

import { z } from "zod";

// Environment validation
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  
  // OAuth Providers
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

// Application config
export const config = {
  appName: "Quark",
  appUrl: env.APP_URL,
  
  features: {
    emailVerification: true,
    oauthProviders: {
      github: !!env.GITHUB_CLIENT_ID,
      google: !!env.GOOGLE_CLIENT_ID,
    },
  },
  
  limits: {
    maxPostsPerUser: 100,
    maxFileUploadSize: 5 * 1024 * 1024, // 5MB
  },
  
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
} as const;

// Feature flags
export const features = {
  isEnabled: (feature: keyof typeof config.features) => {
    return config.features[feature];
  },
} as const;
```

### 4.2 Enhanced `@techstream/quark-db`

```typescript
// packages/db/src/queries.ts

import { prisma } from "./client";
import type { Prisma } from "./generated/prisma";

// Pagination helper
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

async function paginate<T>(
  query: Promise<T[]>,
  countQuery: Promise<number>,
  { page = 1, pageSize = 20 }: PaginationParams
): Promise<PaginatedResult<T>> {
  const [data, total] = await Promise.all([query, countQuery]);
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// User queries
export const users = {
  findById: (id: string) =>
    prisma.user.findUnique({ where: { id } }),

  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email } }),

  create: (data: Prisma.UserCreateInput) =>
    prisma.user.create({ data }),

  update: (id: string, data: Prisma.UserUpdateInput) =>
    prisma.user.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.user.delete({ where: { id } }),

  list: async (params: PaginationParams = {}) => {
    const { page = 1, pageSize = 20 } = params;
    return paginate(
      prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
      params
    );
  },
};

// Post queries
export const posts = {
  findById: (id: string) =>
    prisma.post.findUnique({
      where: { id },
      include: { author: true },
    }),

  create: (data: Prisma.PostCreateInput) =>
    prisma.post.create({ data }),

  update: (id: string, data: Prisma.PostUpdateInput) =>
    prisma.post.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.post.delete({ where: { id } }),

  publish: (id: string) =>
    prisma.post.update({
      where: { id },
      data: { published: true },
    }),

  unpublish: (id: string) =>
    prisma.post.update({
      where: { id },
      data: { published: false },
    }),

  listPublished: async (params: PaginationParams = {}) => {
    const { page = 1, pageSize = 20 } = params;
    return paginate(
      prisma.post.findMany({
        where: { published: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true } } },
      }),
      prisma.post.count({ where: { published: true } }),
      params
    );
  },

  listByAuthor: async (authorId: string, params: PaginationParams = {}) => {
    const { page = 1, pageSize = 20 } = params;
    return paginate(
      prisma.post.findMany({
        where: { authorId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.count({ where: { authorId } }),
      params
    );
  },
};

// Transaction helper
export const transaction = prisma.$transaction.bind(prisma);
```

### 4.3 Enhanced `@techstream/quark-jobs`

```typescript
// packages/jobs/src/definitions.ts

import { z } from "zod";

// Queue definitions
export const QUEUES = {
  EMAIL: "email",
  NOTIFICATIONS: "notifications",
  ANALYTICS: "analytics",
  CLEANUP: "cleanup",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Job definitions with Zod schemas
export const JOBS = {
  // Email jobs
  SEND_WELCOME_EMAIL: {
    queue: QUEUES.EMAIL,
    name: "send-welcome-email",
    schema: z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
    }),
  },
  SEND_PASSWORD_RESET: {
    queue: QUEUES.EMAIL,
    name: "send-password-reset",
    schema: z.object({
      userId: z.string(),
      email: z.string().email(),
      resetToken: z.string(),
    }),
  },
  SEND_EMAIL_VERIFICATION: {
    queue: QUEUES.EMAIL,
    name: "send-email-verification",
    schema: z.object({
      userId: z.string(),
      email: z.string().email(),
      verificationToken: z.string(),
    }),
  },

  // Notification jobs
  SEND_PUSH_NOTIFICATION: {
    queue: QUEUES.NOTIFICATIONS,
    name: "send-push-notification",
    schema: z.object({
      userId: z.string(),
      title: z.string(),
      body: z.string(),
      data: z.record(z.unknown()).optional(),
    }),
  },

  // Analytics jobs
  TRACK_EVENT: {
    queue: QUEUES.ANALYTICS,
    name: "track-event",
    schema: z.object({
      event: z.string(),
      userId: z.string().optional(),
      properties: z.record(z.unknown()).optional(),
      timestamp: z.string().datetime(),
    }),
  },

  // Cleanup jobs
  CLEANUP_EXPIRED_SESSIONS: {
    queue: QUEUES.CLEANUP,
    name: "cleanup-expired-sessions",
    schema: z.object({
      olderThan: z.string().datetime(),
    }),
  },
  CLEANUP_UNVERIFIED_USERS: {
    queue: QUEUES.CLEANUP,
    name: "cleanup-unverified-users",
    schema: z.object({
      olderThan: z.string().datetime(),
    }),
  },
} as const;

// Type helpers
export type JobName = keyof typeof JOBS;
export type JobDefinition<T extends JobName> = (typeof JOBS)[T];
export type JobData<T extends JobName> = z.infer<(typeof JOBS)[T]["schema"]>;

// Job options
export interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  priority?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

// Cron schedules
export const CRON_SCHEDULES = {
  EVERY_MINUTE: "* * * * *",
  EVERY_5_MINUTES: "*/5 * * * *",
  EVERY_HOUR: "0 * * * *",
  EVERY_DAY_MIDNIGHT: "0 0 * * *",
  EVERY_WEEK_SUNDAY: "0 0 * * 0",
} as const;
```

### 4.4 Enhanced `@techstream/quark-ui`

New components to add:

```
packages/ui/src/
├── index.ts
├── button.tsx
├── button.stories.tsx
├── input.tsx              # Text input
├── input.stories.tsx
├── textarea.tsx           # Multiline text
├── textarea.stories.tsx
├── select.tsx             # Dropdown select
├── select.stories.tsx
├── checkbox.tsx           # Checkbox
├── checkbox.stories.tsx
├── card.tsx               # Card container
├── card.stories.tsx
├── modal.tsx              # Modal dialog
├── modal.stories.tsx
├── avatar.tsx             # User avatar
├── avatar.stories.tsx
├── badge.tsx              # Status badge
├── badge.stories.tsx
├── spinner.tsx            # Loading spinner
├── spinner.stories.tsx
├── alert.tsx              # Alert messages
├── alert.stories.tsx
└── styles/
    └── tokens.css         # Design tokens
```

**Example: Input Component**

```tsx
// packages/ui/src/input.tsx
import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            px-3 py-2 rounded-md border transition-colors
            ${error 
              ? "border-red-500 focus:ring-red-500" 
              : "border-gray-300 focus:ring-blue-500"
            }
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${className || ""}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-600">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
```

### Estimated Effort: 5-7 days

---

## Phase 5: Full NextAuth Implementation (Priority: High)

### Current State

- Basic credentials provider only
- No database adapter
- No OAuth providers
- No email verification

### Target State

- Prisma adapter for database sessions
- Multiple OAuth providers (GitHub, Google)
- Email/password with verification
- Magic link authentication
- Session management
- Role-based access control

### Implementation Plan

#### 5.1 Install Dependencies

```bash
pnpm add next-auth @auth/prisma-adapter --filter @techstream/quark-web
pnpm add bcryptjs --filter @techstream/quark-web
pnpm add -D @types/bcryptjs --filter @techstream/quark-web
```

#### 5.2 Create Auth Package

```
packages/auth/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── config.ts         # NextAuth config
    ├── providers.ts      # Provider configurations
    ├── adapter.ts        # Prisma adapter setup
    ├── callbacks.ts      # Auth callbacks
    └── types.ts          # Type augmentations
```

**`packages/auth/src/config.ts`:**

```typescript
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@techstream/quark-db";
import { providers } from "./providers";
import { callbacks } from "./callbacks";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks,
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/auth/new-user",
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  debug: process.env.NODE_ENV === "development",
};
```

**`packages/auth/src/providers.ts`:**

```typescript
import { Provider } from "next-auth/providers";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@techstream/quark-db";
import bcrypt from "bcryptjs";

export const providers: Provider[] = [
  // GitHub OAuth
  ...(process.env.GITHUB_CLIENT_ID
    ? [
        GitHubProvider({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }),
      ]
    : []),

  // Google OAuth
  ...(process.env.GOOGLE_CLIENT_ID
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),

  // Magic Link Email
  ...(process.env.EMAIL_SERVER_HOST
    ? [
        EmailProvider({
          server: {
            host: process.env.EMAIL_SERVER_HOST,
            port: Number(process.env.EMAIL_SERVER_PORT),
            auth: {
              user: process.env.EMAIL_SERVER_USER,
              pass: process.env.EMAIL_SERVER_PASSWORD,
            },
          },
          from: process.env.EMAIL_FROM,
        }),
      ]
    : []),

  // Credentials (email/password)
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Invalid credentials");
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          password: true,
          emailVerified: true,
        },
      });

      if (!user || !user.password) {
        throw new Error("Invalid credentials");
      }

      const isValid = await bcrypt.compare(credentials.password, user.password);

      if (!isValid) {
        throw new Error("Invalid credentials");
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];
```

**`packages/auth/src/callbacks.ts`:**

```typescript
import { NextAuthOptions } from "next-auth";
import { prisma } from "@techstream/quark-db";

export const callbacks: NextAuthOptions["callbacks"] = {
  async signIn({ user, account, profile }) {
    // Allow OAuth without email verification
    if (account?.provider !== "credentials") {
      return true;
    }

    // Check email verification for credentials
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });

    if (!existingUser?.emailVerified) {
      return false; // Block sign in if email not verified
    }

    return true;
  },

  async session({ session, user }) {
    if (session.user) {
      session.user.id = user.id;
      // Add custom fields
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      session.user.role = dbUser?.role || "user";
    }
    return session;
  },

  async redirect({ url, baseUrl }) {
    // Allows relative callback URLs
    if (url.startsWith("/")) return `${baseUrl}${url}`;
    // Allows callback URLs on the same origin
    if (new URL(url).origin === baseUrl) return url;
    return baseUrl;
  },
};
```

#### 5.3 Update Prisma Schema for Auth

Add to `schema.prisma`:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?   // For credentials auth
  role          String    @default("user") // user, admin, etc.
  
  accounts      Account[]
  sessions      Session[]
  posts         Post[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

#### 5.4 Auth UI Components

Create auth-specific pages in the web app:

```
apps/web/src/app/
├── auth/
│   ├── signin/
│   │   └── page.tsx       # Sign in page with all providers
│   ├── signup/
│   │   └── page.tsx       # Registration page
│   ├── signout/
│   │   └── page.tsx       # Sign out confirmation
│   ├── error/
│   │   └── page.tsx       # Auth error page
│   ├── verify-request/
│   │   └── page.tsx       # Email verification sent
│   └── new-user/
│       └── page.tsx       # Post-registration onboarding
```

### Estimated Effort: 4-5 days

---

## Implementation Timeline

### Recommended Order

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | UI Playground (Storybook) | 2-3 days | None |
| 2 | Worker Playground | 3-4 days | None |
| 3 | Prisma Schema Refactor | 1-2 days | None |
| 4 | Expanded Packages | 5-7 days | Phase 3 |
| 5 | Full NextAuth | 4-5 days | Phase 3, 4 |

**Total Estimated Time: 15-21 days**

### Sprint Breakdown

#### Sprint 1 (Week 1-2)
- [ ] Set up Storybook UI Playground
- [ ] Create base UI components with stories
- [ ] Set up Worker Playground with Bull Board
- [ ] Refactor Prisma schema (multi-file or sectioned)

#### Sprint 2 (Week 2-3)
- [ ] Expand `@techstream/quark-config` with env validation
- [ ] Expand `@techstream/quark-db` with pagination and more queries
- [ ] Expand `@techstream/quark-jobs` with additional job types
- [ ] Add more UI components

#### Sprint 3 (Week 3-4)
- [ ] Implement full NextAuth with Prisma adapter
- [ ] Add OAuth providers (GitHub, Google)
- [ ] Create auth UI pages
- [ ] Add email verification flow
- [ ] Testing and documentation

---

## Additional Recommendations

### 1. New Package: `@quark/email`

For email templates and sending:

```
packages/email/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── client.ts          # Email sending (nodemailer/resend)
    └── templates/
        ├── welcome.tsx     # React Email template
        ├── password-reset.tsx
        └── verification.tsx
```

Consider using [React Email](https://react.email/) for type-safe email templates.

### 2. New Package: `@quark/validators`

Shared Zod schemas:

```
packages/validators/
└── src/
    ├── index.ts
    ├── user.ts            # User validation schemas
    ├── post.ts            # Post validation schemas
    └── common.ts          # Shared validation (email, pagination, etc.)
```

### 3. Testing Infrastructure

- Add Playwright for E2E testing
- Add MSW (Mock Service Worker) for API mocking
- Consider Chromatic for visual regression testing with Storybook

### 4. Documentation

- Add Turborepo docs generation
- Consider Mintlify or Nextra for documentation site
- Add JSDoc comments to all exported functions

### 5. CI/CD Enhancements

```yaml
# .github/workflows/ci.yml additions
jobs:
  storybook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm storybook:build
      - uses: chromaui/action@v1  # Visual regression

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm playwright test
```

---

## Quick Start Commands

After implementing this roadmap:

```bash
# Start all development servers
pnpm dev

# Start Storybook only
pnpm storybook

# Start worker playground
pnpm --filter worker-playground dev

# Run all tests
pnpm test

# Generate Prisma client after schema changes
pnpm db:generate

# Run database migrations
pnpm db:migrate
```

---

## Testing Infrastructure

### Completed

- ✅ Non-interactive CLI mode for automation (`--no-prompts`, `--features`, `--skip-install`, `--skip-docker`)
- ✅ Full lifecycle E2E test (create → Docker startup → database migration → HTTP health check)
- ✅ CI/CD GitHub Actions workflows (PR validation + nightly full lifecycle test)
- ✅ Automated flag validation tests (9 test cases, 100% pass rate)

### Upcoming

- ⬜ E2E test performance monitoring dashboard
- ⬜ Cross-platform testing (Windows, macOS, Linux)
- ⬜ Multi-Node version matrix testing

---

## Questions to Consider

1. **Authentication Priority**: Which OAuth providers are most important for your users?
2. **UI Design System**: Do you want to adopt an existing design system (Radix, Shadcn) or build custom?
3. **Job Queue Scale**: How many concurrent workers do you anticipate needing?
4. **Database Scale**: Do you need connection pooling (PgBouncer, Prisma Accelerate)?
5. **Deployment Target**: Vercel, AWS, self-hosted? This affects architecture decisions.

---

*Document created: November 2024*
*Last updated: November 2024*
