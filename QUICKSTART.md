# Quick Start — Creating a New Project with Quark

Quark provides a **CLI tool** to scaffold new projects instantly with a full-stack setup.

## Prerequisites

- Node.js 18+
- pnpm 9+
- Docker & Docker Compose (for local development)

## Create a New App (Fastest Way)

### **Step 1: Clone the Quark repository** (one-time setup)

```bash
git clone <quark-repo-url> quark
cd quark
pnpm install
```

### **Step 2: Create your new app**

From the Quark repo root, run:

```bash
pnpm new my-awesome-app
```

This will:
- Prompt you to select optional packages (UI, Jobs, Config)
- Create a scaffolded project with the full Quark stack
- Initialize git in the new project

### **Step 3: Navigate to your app**

```bash
cd ../my-awesome-app
```

### **Step 4: Configure Environment**

```bash
cp .env.example .env
```

Edit `.env`:
- Set `NEXTAUTH_SECRET` (run `openssl rand -base64 32`)
- (Optional) Add `GITHUB_ID` and `GITHUB_SECRET` for GitHub login

### **Step 5: Start Services**

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, and other services.

### **Step 6: Initialize Database**

```bash
pnpm db:push    # Sync schema
pnpm db:seed    # Seed test data
```

### **Step 7: Run Your App**

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Quick Test

### Create a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@app.com", "password": "password123", "name": "Developer"}'
```

### Login

Visit `http://localhost:3000/api/auth/signin` and use credentials above.

### View Posts

Once logged in, visit `http://localhost:3000/api/posts`.


#### **Step 4: Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your project-specific settings
```

#### **Step 5: Start infrastructure**
```bash
pnpm docker:up
```

#### **Step 6: Generate database client**
```bash
pnpm db:generate
```

#### **Step 7: Start development**
```bash
pnpm dev
```

Your project is now running! The Next.js frontend is typically available at `http://localhost:3000`.

---

## What You Get

By using Quark as a base, you inherit:

- **Frontend**: Next.js 16 with App Router (`apps/web`)
- **Background worker**: Job processing service (`apps/worker`)
- **Database**: Prisma ORM with schema (`packages/db`)
- **Shared UI**: Reusable React components (`packages/ui`)
- **Job queue**: Job definitions (`packages/jobs`)
- **Configuration**: Shared config (`packages/config`)
- **Build tooling**: Turborepo, Biome, TypeScript
- **Infrastructure**: Docker Compose setup

---

## Customizing for Your Project

- **Rename the project**: Update `"name"` in root `package.json`
- **Remove unused apps**: Delete `apps/worker` if you don't need background jobs
- **Update environment variables**: Customize `.env` for your needs
- **Add your own packages**: Create new packages in `packages/` as needed
- **Modify the schema**: Update `packages/db/prisma/schema.prisma` for your data model

---

## Next Steps

See the main [README.md](./README.md) for development workflows, testing, and deployment guidance.
