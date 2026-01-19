# Quick Start — Starting a New Project from Quark

This guide explains how to bootstrap a new project using the Quark monorepo as your base.

## Starting a New Project from Quark

### **Option 1: Clone Quark and customize**

The simplest way to start a new project is to clone Quark and adapt it for your needs.

#### **Step 1: Clone the repository**
```bash
# Clone Quark (replace with your repo URL)
git clone <quark-repo-url> my-new-project
cd my-new-project
```

#### **Step 2: Remove the original git history**
```bash
# Start fresh with your own git history
rm -rf .git
git init
git add .
git commit -m "Initial commit from Quark template"
```

#### **Step 3: Install dependencies**
```bash
pnpm install
```

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
