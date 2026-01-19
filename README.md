# Quark

## Overview

Quark is a modern monorepo built with Turborepo, Next.js, and Prisma.

## Architecture

- **apps/web**: Next.js 16 App Router frontend
- **apps/worker**: Background worker service
- **packages/db**: Prisma database client and schema
- **packages/jobs**: Job queue definitions
- **packages/ui**: Shared UI components
- **packages/config**: Shared configuration

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start infrastructure:**
   ```bash
   docker compose up -d
   ```

4. **Generate database client:**
   ```bash
   pnpm db:generate
   ```

5. **Run development server:**
   ```bash
   pnpm dev
   ```

## Development

- **Linting**: `pnpm lint`
- **Testing**: `pnpm test`
- **Building**: `pnpm build`
