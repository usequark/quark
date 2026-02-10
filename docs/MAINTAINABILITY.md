# Quark Maintainability Guide

## Overview

This document provides guidelines and best practices for maintaining projects built on the Quark monorepo. Following these practices ensures long-term code health, reduces technical debt, and improves developer experience across teams.

---

## Table of Contents

1. [Code Organization](#code-organization)
2. [Dependency Management](#dependency-management)
3. [Testing Strategy](#testing-strategy)
4. [Code Quality](#code-quality)
5. [Documentation](#documentation)
6. [Version Control](#version-control)
7. [Monitoring & Observability](#monitoring--observability)
8. [Refactoring Guidelines](#refactoring-guidelines)
9. [Technical Debt Management](#technical-debt-management)
10. [Upgrade Strategy](#upgrade-strategy)

---

## Code Organization

### Package Structure

Each package in the monorepo should follow a consistent structure:

```
packages/example/
├── package.json          # Package manifest
├── tsconfig.json         # TypeScript configuration (extends base)
├── src/
│   ├── index.ts          # Public API exports
│   ├── feature.ts        # Feature implementation
│   └── feature.test.ts   # Co-located tests
└── coverage/             # Test coverage reports
```

### Separation of Concerns

| Package | Responsibility | Should NOT Contain |
|---------|---------------|-------------------|
| `@Bobnoddle/quark-config` | App configuration, environment variables | Business logic, UI code |
| `@Bobnoddle/quark-db` | Database client, queries, Prisma schema | HTTP handlers, UI code |
| `@Bobnoddle/quark-jobs` | Job queue definitions, worker logic | Database queries, UI code |
| `@Bobnoddle/quark-ui` | Reusable UI components | Business logic, API calls |

### Import Guidelines

```typescript
// ✅ Good - Import from package public API
import { Button } from "@Bobnoddle/quark-ui";
import { prisma, user } from "@Bobnoddle/quark-db";

// ❌ Bad - Deep imports bypass the public API
import { Button } from "@Bobnoddle/quark-ui/src/button";
import { prisma } from "@Bobnoddle/quark-db/src/client";
```

### Barrel Exports

Each package should have an `index.ts` that exports its public API:

```typescript
// packages/ui/src/index.ts
export { Button } from "./button";
export type { ButtonProps } from "./button";

// Future exports
// export { Input } from "./input";
// export { Card } from "./card";
```

---

## Dependency Management

### Internal Dependencies

Use workspace protocol for internal packages:

```json
{
  "dependencies": {
    "@Bobnoddle/quark-ui": "workspace:*",
    "@Bobnoddle/quark-db": "workspace:*"
  }
}
```

### External Dependencies

#### Shared Dependencies

Place shared dependencies in the root `package.json`:

- TypeScript
- Testing frameworks (Vitest)
- Linting tools (Biome)
- Build tools

#### Package-Specific Dependencies

Place package-specific dependencies in the package's `package.json`:

```json
// packages/db/package.json
{
  "dependencies": {
    "@prisma/client": "^6.x"
  },
  "devDependencies": {
    "prisma": "^6.x"
  }
}
```

### Dependency Updates

1. **Weekly**: Review Dependabot/Renovate PRs for security updates
2. **Monthly**: Audit and update minor versions
3. **Quarterly**: Evaluate major version upgrades

#### Update Command

```bash
# Check for outdated packages
pnpm outdated

# Update all packages interactively
pnpm update --interactive --latest

# Update specific package across workspace
pnpm update <package> --recursive
```

### Avoiding Dependency Bloat

- Prefer built-in Node.js APIs over external packages
- Audit bundle size impact before adding new dependencies
- Use `pnpm why <package>` to understand dependency trees
- Remove unused dependencies regularly

---

## Testing Strategy

### Test Pyramid

```
         /\
        /  \        E2E Tests (Playwright)
       /----\       - Critical user journeys
      /      \      - Smoke tests
     /--------\     Integration Tests
    /          \    - API routes
   /------------\   - Database queries
  /              \  Unit Tests
 /----------------\ - Components
/                  \- Utilities
```

### Test Organization

Co-locate tests with source files:

```
src/
├── button.tsx
├── button.test.tsx     # Unit tests
└── button.stories.tsx  # Storybook (visual testing)
```

### Coverage Requirements

| Type | Minimum Coverage | Target Coverage |
|------|-----------------|-----------------|
| Unit Tests | 70% | 85% |
| Integration Tests | 50% | 70% |
| Critical Paths | 90% | 100% |

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run tests for specific package
pnpm test --filter @Bobnoddle/quark-ui
```

### Test Naming Conventions

```typescript
describe("Button", () => {
  it("renders with default variant", () => {});
  it("applies secondary variant styles", () => {});
  it("handles click events", () => {});
  it("disables interaction when disabled prop is true", () => {});
});
```

---

## Code Quality

### Linting & Formatting

This monorepo uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check for issues
pnpm lint

# Fix auto-fixable issues
pnpm lint --write

# Format code
pnpm format
```

### Biome Configuration

The `biome.json` at the root applies to all packages. Package-specific overrides can extend it.

### TypeScript Best Practices

#### Strict Mode

All packages extend `tsconfig.base.json` with strict settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### Type Exports

Always export types alongside implementations:

```typescript
// ✅ Good
export interface ButtonProps {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({ variant = "primary", children }: ButtonProps) {
  // ...
}

// Re-export in index.ts
export { Button } from "./button";
export type { ButtonProps } from "./button";
```

#### Avoid `any`

```typescript
// ❌ Bad
function process(data: any) {}

// ✅ Good
function process(data: unknown) {
  if (isValidData(data)) {
    // Now TypeScript knows the shape
  }
}
```

### Code Review Checklist

- [ ] Tests added/updated for changes
- [ ] TypeScript types are correct (no `any`)
- [ ] No console.log statements (use proper logging)
- [ ] Error handling is appropriate
- [ ] Documentation updated if needed
- [ ] No hardcoded values (use config)
- [ ] Follows existing code patterns

---

## Documentation

### Code Documentation

#### JSDoc Comments

Document public APIs with JSDoc:

```typescript
/**
 * Creates a new user in the database.
 * 
 * @param data - The user data to create
 * @returns The created user object
 * @throws {PrismaClientKnownRequestError} If email already exists
 * 
 * @example
 * ```ts
 * const user = await user.create({
 *   email: "john@example.com",
 *   name: "John Doe"
 * });
 * ```
 */
export async function create(data: Prisma.UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}
```

### README Requirements

Each package should have a README with:

1. **Purpose** - What the package does
2. **Installation** - How to add it to a project
3. **Usage** - Basic examples
4. **API Reference** - Exported functions/components
5. **Contributing** - How to contribute

### Keeping Docs Updated

- Update docs in the same PR as code changes
- Review docs quarterly for accuracy
- Use `docs/` folder for architecture decisions

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, getting started |
| `docs/API.md` | API reference documentation |
| `docs/ROADMAP.md` | Future plans and architecture |
| `docs/MAINTAINABILITY.md` | This document |
| `CHANGELOG.md` | Version history (per package) |
| `CONTRIBUTING.md` | Contribution guidelines |

---

## Version Control

### Branch Strategy

```
main                    # Production-ready code
├── develop             # Integration branch (optional)
├── feature/ABC-123     # Feature branches
├── fix/ABC-456         # Bug fix branches
└── release/v1.2.0      # Release preparation
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(ui): add Input component with validation support
fix(db): handle null email in user queries
docs(api): update authentication endpoints
refactor(jobs): extract queue configuration to separate file
test(ui): add Button accessibility tests
chore(deps): update prisma to v6.2.0
```

### Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**: Include context, screenshots if UI change
3. **Size**: Keep PRs focused (<400 lines when possible)
4. **Reviews**: Require at least one approval
5. **CI**: All checks must pass

---

## Monitoring & Observability

### Logging Standards

```typescript
// Use structured logging
import { logger } from "@Bobnoddle/quark-config";

// ✅ Good - Structured with context
logger.info("User created", { 
  userId: user.id, 
  email: user.email 
});

logger.error("Failed to process job", { 
  jobId: job.id, 
  error: error.message,
  stack: error.stack 
});

// ❌ Bad - Unstructured
console.log("User created: " + user.id);
```

### Error Handling

```typescript
// Define custom errors
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

// Handle errors consistently
try {
  const user = await user.findById(id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle 404
  }
  // Log and rethrow unexpected errors
  logger.error("Unexpected error", { error });
  throw error;
}
```

### Health Checks

Implement health check endpoints for all services:

```typescript
// apps/web/src/app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    timestamp: new Date().toISOString(),
  };

  const healthy = Object.values(checks).every(
    (check) => check === true || typeof check === "string"
  );

  return Response.json(checks, { 
    status: healthy ? 200 : 503 
  });
}
```

---

## Refactoring Guidelines

### When to Refactor

- **Rule of Three**: If you're copying code a third time, extract it
- **Complexity**: When cyclomatic complexity exceeds 10
- **Readability**: When code requires comments to understand
- **Performance**: When profiling identifies bottlenecks

### Safe Refactoring Process

1. **Ensure test coverage** before refactoring
2. **Make small, incremental changes**
3. **Run tests after each change**
4. **Commit frequently** with clear messages
5. **Get code review** for significant changes

### Common Refactoring Patterns

| Pattern | When to Apply |
|---------|--------------|
| Extract Function | Long functions (>30 lines) |
| Extract Component | Repeated UI patterns |
| Extract Hook | Shared React state logic |
| Extract Package | Shared business logic across apps |
| Rename | Unclear naming |
| Move | Wrong location in structure |

### Example: Extracting Shared Logic

```typescript
// Before: Duplicated in multiple files
async function getUserPosts(userId: string) {
  const posts = await prisma.post.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
  });
  return posts;
}

// After: Centralized in @Bobnoddle/quark-db
// packages/db/src/queries.ts
export const post = {
  findByAuthor: (authorId: string) =>
    prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: "desc" },
    }),
};
```

---

## Technical Debt Management

### Tracking Technical Debt

Use `TODO`, `FIXME`, and `HACK` comments with ticket references:

```typescript
// TODO(ABC-123): Add pagination support
// FIXME(ABC-456): Race condition in concurrent updates
// HACK(ABC-789): Workaround for library bug, remove after v2.0
```

### Technical Debt Register

Maintain a list of known technical debt:

| ID | Description | Impact | Effort | Priority |
|----|-------------|--------|--------|----------|
| TD-001 | No pagination in user list | High - Performance | Medium | High |
| TD-002 | Hardcoded config values | Medium - Flexibility | Low | Medium |
| TD-003 | Missing error boundaries | Medium - UX | Low | Medium |

### Addressing Technical Debt

- **Sprint allocation**: Reserve 15-20% of sprint capacity
- **Boy Scout Rule**: Leave code cleaner than you found it
- **Debt sprints**: Periodic sprints focused on debt reduction

---

## Upgrade Strategy

### Framework Upgrades

#### Before Upgrading

1. Read the changelog and migration guide
2. Check for breaking changes
3. Verify all dependencies are compatible
4. Create a branch for the upgrade

#### Upgrade Process

```bash
# 1. Create upgrade branch
git checkout -b chore/upgrade-next-16

# 2. Update package versions
pnpm update next@latest --filter @quark/web

# 3. Run tests
pnpm test

# 4. Fix any issues
# ...

# 5. Build all packages
pnpm build

# 6. Manual testing in development
pnpm dev
```

### Database Migrations

```bash
# 1. Make schema changes
# Edit packages/db/prisma/schema.prisma

# 2. Create migration
pnpm db:migrate

# 3. Test migration on staging first
# 4. Apply to production with backup
```

### Deprecation Process

When deprecating code:

1. **Mark as deprecated** with JSDoc

```typescript
/**
 * @deprecated Use `user.findById()` instead. Will be removed in v2.0.
 */
export function getUserById(id: string) {
  console.warn("getUserById is deprecated, use user.findById instead");
  return user.findById(id);
}
```

2. **Log warnings** in development
3. **Document** in changelog
4. **Remove** after grace period (usually 2 major versions)

---

## Monorepo-Specific Guidelines

### Adding New Packages

1. Create package directory:
   ```bash
   mkdir -p packages/new-package/src
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@quark/new-package",
     "version": "0.0.0",
     "private": true,
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "scripts": {
       "test": "vitest run",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

3. Create `tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "include": ["src/**/*"],
     "exclude": ["node_modules"]
   }
   ```

4. Install dependencies and update lockfile:
   ```bash
   pnpm install
   ```

### Removing Packages

1. Remove from dependent packages first
2. Update all imports
3. Run tests to verify
4. Delete package directory
5. Run `pnpm install` to update lockfile

### Cross-Package Changes

When making changes that affect multiple packages:

1. Plan the order of changes
2. Update shared packages first
3. Then update dependent packages
4. Test the entire dependency chain

---

## Performance Considerations

### Build Performance

```bash
# Use Turborepo cache effectively
pnpm build

# View cache status
turbo run build --dry-run
```

### Runtime Performance

- Use React Server Components where possible
- Implement proper data fetching patterns
- Optimize database queries with indexes
- Use connection pooling for database

### Bundle Size

```bash
# Analyze web bundle
pnpm --filter @quark/web analyze

# Check for duplicate dependencies
pnpm dedupe
```

---

## Quick Reference

### Common Commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Run development | `pnpm dev` |
| Run tests | `pnpm test` |
| Run linting | `pnpm lint` |
| Build all | `pnpm build` |
| Generate Prisma | `pnpm db:generate` |
| Run migrations | `pnpm db:migrate` |

### Key Files

| File | Purpose |
|------|---------|
| `turbo.json` | Turborepo task configuration |
| `pnpm-workspace.yaml` | Workspace packages definition |
| `tsconfig.base.json` | Shared TypeScript config |
| `biome.json` | Linting/formatting rules |
| `vitest.config.ts` | Test configuration |

---

## Further Reading

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Prisma Best Practices](https://www.prisma.io/docs/guides)
- [Next.js Documentation](https://nextjs.org/docs)

---

*Document created: November 2024*
*Last updated: November 2024*
