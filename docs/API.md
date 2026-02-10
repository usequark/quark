# Quark API Documentation

## Overview

Quark provides a REST API for interacting with the platform. Authentication is handled via NextAuth.js.

---

## Authentication

### `POST /api/auth/signin`

Sign in with credentials.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** Redirects to callback URL with session cookie.

### `GET /api/auth/session`

Get the current session.

**Response:**
```json
{
  "user": {
    "name": "J Smith",
    "email": "jsmith@example.com"
  },
  "expires": "2025-12-26T00:00:00.000Z"
}
```

### `POST /api/auth/signout`

Sign out the current user.

**Response:** Redirects to home page.

---

## Database Models

### User

| Field     | Type     | Description              |
|-----------|----------|--------------------------|
| id        | String   | Unique identifier (CUID) |
| email     | String   | User email (unique)      |
| name      | String?  | Optional display name    |
| createdAt | DateTime | Creation timestamp       |
| updatedAt | DateTime | Last update timestamp    |
| posts     | Post[]   | User's posts             |

### Post

| Field     | Type     | Description              |
|-----------|----------|--------------------------|
| id        | String   | Unique identifier (CUID) |
| title     | String   | Post title               |
| content   | String?  | Post content             |
| published | Boolean  | Publication status       |
| authorId  | String   | Author's user ID         |
| author    | User     | Author relation          |
| createdAt | DateTime | Creation timestamp       |
| updatedAt | DateTime | Last update timestamp    |

---

## Job Queues

### Email Queue

Queue name: `email-queue`

#### Jobs

**SEND_WELCOME_EMAIL**

Sends a welcome email to a new user.

```typescript
interface EmailJobData {
  to: string;      // Recipient email
  subject: string; // Email subject
  body: string;    // Email body (HTML)
}
```

---

## Packages

### @Bobnoddle/quark-db

Database client and query helpers.

```typescript
import { prisma, user, post } from "@Bobnoddle/quark-db";

// Find user by ID
const foundUser = await user.findById("cuid123");

// Find user by email
const userByEmail = await user.findByEmail("test@example.com");

// Create user
const newUser = await user.create({ email: "new@example.com", name: "New User" });

// Create post
const newPost = await post.create({ title: "My Post", authorId: "cuid123" });

// Get published posts
const publishedPosts = await post.findPublished();
```

### @Bobnoddle/quark-ui

Shared UI components.

```tsx
import { Button } from "@Bobnoddle/quark-ui";

// Primary button (default)
<Button>Click me</Button>

// Secondary button
<Button variant="secondary">Cancel</Button>

// With additional props
<Button disabled onClick={() => {}}>Submit</Button>
```

### @Bobnoddle/quark-jobs

Job queue definitions.

```typescript
import { JOB_QUEUES, JOB_NAMES, EmailJobData } from "@Bobnoddle/quark-jobs";

// Queue names
JOB_QUEUES.EMAIL // "email-queue"

// Job names
JOB_NAMES.SEND_WELCOME_EMAIL // "send-welcome-email"
```

### @Bobnoddle/quark-config

Shared configuration.

```typescript
import { config } from "@Bobnoddle/quark-config";

config.appName // "Quark"
```

---

## Environment Variables

| Variable          | Description                    | Example                                    |
|-------------------|--------------------------------|--------------------------------------------|
| DATABASE_URL      | PostgreSQL connection string   | postgresql://user:pass@localhost:5432/db   |
| REDIS_URL         | Redis connection string        | redis://localhost:6379                     |
| NEXTAUTH_SECRET   | NextAuth.js secret key         | your_very_long_secure_secret_here          |
| MAILHOG_SMTP_URL  | SMTP server URL                | smtp://localhost:1025                      |
| WEB_PORT          | Web app port                   | 3000                                       |
