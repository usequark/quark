# Quark Default Minimal Admin UI — Architectural Analysis & Proposal

**Date:** February 23, 2026  
**Status:** Proposal for Review  

---

## Executive Summary

This document analyzes the feasibility and design of a **default minimal admin UI** to be scaffolded with every new Quark project. The proposal recommends implementing a **lightweight, RBAC-protected dashboard** within the existing Next.js web app that provides visibility into core infrastructure (users, jobs, audit logs, files) without imposing opinionated domain-specific admin features.

**Recommendation: PROCEED** with a phased, opt-in approach that provides foundational admin capabilities while maintaining Quark's philosophy of local control over domain logic.

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

Quark scaffolds projects with:
- **Next.js 16** (App Router, Server Actions) in `apps/web`
- **Prisma 7 + PostgreSQL** with pre-defined models: `User`, `Account`, `Session`, `File`, `Job`, `AuditLog`
- **NextAuth v5** (beta) for authentication with role support (`User.role`)
- **@techstream/quark-core** providing RBAC authorization (`authorization.js`)
- **Tailwind CSS + Shadcn UI** as the base component library in `packages/ui`
- **Zod validation** for all inputs

### 1.2 Existing API Routes

The web app already has:
- `/api/users` — user management endpoints
- `/api/files` — file management
- `/api/csrf` — CSRF token generation
- `/api/metrics` — Prometheus metrics
- `/api/health` — health checks
- `/api/auth/*` — NextAuth routes

### 1.3 Missing: Admin Interface

Currently, **no admin UI exists**. Operators have no built-in visibility into:
- User accounts and roles
- Background jobs (status, failures, retries)
- System audit logs
- File uploads
- Core metrics and health

---

## 2. Design Philosophy

The admin UI must align with Quark's core principle: **Core infrastructure from registry + local domain logic**.

### What the Admin UI Should Be:
✅ **Infrastructure-focused** — Manages Quark core models (User, Job, File, AuditLog)  
✅ **Read/query-oriented** — Primarily displays data; minimal mutations  
✅ **RBAC-protected** — Accessible only to admin/operator roles  
✅ **Minimal and unopinionated** — Does not scaffold domain-specific admin features  
✅ **Composable** — Developers can extend with custom admin pages  
✅ **Self-contained** — Lives in `apps/web/src/app/admin`, optional to use  

### What the Admin UI Should NOT Be:
❌ **Opinionated about domain models** — No scaffolded Product admin, Post admin, etc.  
❌ **Feature-complete** — Not a full CMS or admin dashboard generator  
❌ **Required** — Should be optional; projects can ignore it  
❌ **Bloated** — Minimal feature set, no unnecessary dependencies  

---

## 3. Proposed Architecture

### 3.1 Directory Structure

```
apps/web/
├── src/
│   └── app/
│       ├── admin/                          # NEW: Protected admin routes
│       │   ├── layout.js                   # Admin layout with nav + auth check
│       │   ├── page.js                     # Overview/dashboard
│       │   ├── users/
│       │   │   └── page.js                 # User management
│       │   ├── jobs/
│       │   │   └── page.js                 # Job queue monitoring
│       │   ├── files/
│       │   │   └── page.js                 # Uploaded files browser
│       │   ├── audit-logs/
│       │   │   └── page.js                 # Audit log viewer
│       │   └── settings/
│       │       └── page.js                 # Admin settings (optional)
│       ├── api/
│       │   └── admin/                      # NEW: Admin API routes
│       │       ├── users/route.js          # GET/PATCH users
│       │       ├── jobs/route.js           # GET/PATCH jobs (retry/cancel)
│       │       ├── files/route.js          # GET files metadata
│       │       └── audit-logs/route.js     # GET audit logs
│       └── ...existing routes...
└── ...
```

### 3.2 Layout & Navigation

```javascript
// apps/web/src/app/admin/layout.js
// - Check if user is authenticated + has admin role
// - Render sidebar with navigation:
//   - Overview
//   - Users
//   - Jobs
//   - Files
//   - Audit Logs
//   - Settings (optional)
// - Main content area with breadcrumbs & child page
```

**Visual Structure:**
```
┌─────────────────────────────────────────┐
│  Quark Admin              [user] [logout]│
├──────────────┬──────────────────────────┤
│ • Overview   │                          │
│ • Users      │    <Page Content>        │
│ • Jobs       │                          │
│ • Files      │    Tables, filters,      │
│ • Audit Logs │    pagination, actions   │
│ • Settings   │                          │
└──────────────┴──────────────────────────┘
```

---

## 4. Minimal Feature Set

### 4.1 Overview Dashboard

**Purpose:** High-level system health snapshot

**Metrics:**
- Total users (count)
- Active sessions (count)
- Pending jobs (count)
- Failed jobs (count, with link to details)
- Recent audit logs (latest 5)
- System health (API response, Redis ping, DB status)

**Components Required:**
- `StatCard` — Display a metric + value
- `RecentActivityList` — Render recent audit logs
- `HealthIndicator` — Shows green/red status for dependencies

### 4.2 Users Management

**Purpose:** View and manage user accounts

**Features:**
- Table listing all users with columns: Email, Name, Role, Created, Status
- Search/filter by email or name
- Sort by any column
- Bulk actions: Deactivate/delete (with confirmation)
- Edit single user: Change role, name, email; reset password (send reset link)
- Pagination (20 per page)

**Components Required:**
- `DataTable` (reusable Shadcn component)
- `UserForm` — Modal for editing user
- `RoleSelect` — Dropdown for role selection

**API Endpoint:**
```
GET  /api/admin/users?page=1&search=&role=
PATCH /api/admin/users/:id (change role, name, email)
DELETE /api/admin/users/:id (soft delete, requires confirm)
POST /api/admin/users/:id/reset-password (send reset email)
```

### 4.3 Job Queue Monitor

**Purpose:** Visibility into background jobs (BullMQ)

**Features:**
- Table listing jobs with columns: Queue, Job Name, Status, Created, Started, Completed
- Filter by queue and status
- View job details (data, error message, retry count)
- Actions: Retry failed job, cancel pending job
- Pagination

**Status Display:**
- 🟡 `PENDING` — Gray, awaiting processing
- 🔵 `IN_PROGRESS` — Blue, currently running
- 🟢 `COMPLETED` — Green
- 🔴 `FAILED` — Red, shows error message

**Components Required:**
- `JobStatusBadge` — Color-coded status indicator
- `JobErrorModal` — Shows full error details
- `JobDataViewer` — JSON syntax-highlighted job data

**API Endpoint:**
```
GET  /api/admin/jobs?page=1&queue=&status=
GET  /api/admin/jobs/:id (detailed info)
POST /api/admin/jobs/:id/retry (requires status=FAILED)
POST /api/admin/jobs/:id/cancel (requires status=PENDING)
```

### 4.4 Files Browser

**Purpose:** View uploaded files, manage storage

**Features:**
- Table listing files: Filename, MIME type, Size, Uploaded By, Upload Date
- Filter by MIME type or uploader
- Sort by size, date, name
- Download file (if public)
- Delete file (from filesystem/S3)
- Pagination

**Components Required:**
- `FilePreview` — Show thumbnail for images
- `FileSizeBadge` — Human-readable file size

**API Endpoint:**
```
GET  /api/admin/files?page=1&mimeType=&uploadedBy=
DELETE /api/admin/files/:id (delete from storage)
```

### 4.5 Audit Log Viewer

**Purpose:** Track all system changes for compliance/debugging

**Features:**
- Table listing audit logs: User, Action, Entity Type, Entity ID, Timestamp
- Filter by user, action, entity type
- View change details (JSON diff)
- Pagination with time-based filtering (last 7/30 days)

**Components Required:**
- `AuditLogDetailsModal` — Shows before/after JSON
- `ActionBadge` — Color by action type (CREATE=green, UPDATE=blue, DELETE=red)

**API Endpoint:**
```
GET /api/admin/audit-logs?page=1&user=&action=&days=30
GET /api/admin/audit-logs/:id (full details with diffs)
```

### 4.6 Settings (Optional)

**Purpose:** Admin-level configuration

**Features:**
- View/edit global settings (if app defines them)
- Manage allowed file types/size limits
- Job queue configuration (retention, retry policies)
- Email configuration display (masked secrets)

*This page can be stubbed initially and extended per-project.*

---

## 5. Implementation Approach

### 5.1 Phase 1: Scaffolded Foundation (What's Applied to New Projects)

1. **Create admin pages** — Basic structure, empty state pages
2. **Create API routes** — Query existing Quark models
3. **Add RBAC middleware** — Protect `/admin` routes (require `admin` role)
4. **Create shared components** — `DataTable`, `StatCard`, `StatusBadge`, etc.
5. **Add to CLI templates** — Include admin in `@techstream/quark-create-app`

**Files to add to templates:**
```
templates/base-project/
├── src/app/admin/
│   ├── layout.js
│   ├── page.js
│   ├── users/page.js
│   ├── jobs/page.js
│   ├── files/page.js
│   ├── audit-logs/page.js
│   └── components/               # Shared components
│       ├── DataTable.js
│       ├── StatCard.js
│       ├── StatusBadge.js
│       └── ...
├── src/app/api/admin/
│   ├── users/route.js
│   ├── jobs/route.js
│   ├── files/route.js
│   └── audit-logs/route.js
└── src/lib/admin/
    ├── permissions.js            # Helper to check admin role
    └── formatters.js             # Utilities for formatting data
```

### 5.2 Phase 2: Core Package Enhancement (Optional)

Optionally, add shared utilities to `@techstream/quark-core`:
- `createAdminAuthMiddleware()` — Reusable RBAC check
- `AdminError` — Custom error type for admin-specific errors
- Common types/schemas for admin API responses

**This keeps admin utilities in the registry while pages remain local.**

### 5.3 Rollout Strategy

**For Quark Framework:**
1. Implement admin UI in the reference `apps/web` app
2. Add admin routes to CLI templates
3. Document in `docs/ADMIN_UI.md` with customization examples

**For Existing Projects:**
- Admin scaffold is **optional** — run your own update command
- Provide a migration guide to manually add admin if desired

---

## 6. UI/UX Design Details

### 6.1 Visual Style

- **Use existing Shadcn components:** Button, Card, Table, Dialog, Input, Select, Badge
- **Tailwind utilities** for spacing, colors, typography
- **Dark mode support** (Shadcn already includes toggle)
- **Responsive design:** Sidebar collapses on mobile, tables scroll horizontally

### 6.2 Interaction Patterns

**Data Tables:**
- Sortable columns (click header)
- Filterable (dropdowns, search input)
- Pagination controls (prev/next, jump to page)
- **Bulk actions** (checkboxes to select rows)

**Forms & Dialogs:**
- Inline editing or modal dialogs
- Validation errors displayed in-field
- Confirmation dialogs for destructive actions (delete, reset password)
- Loading states for async operations

**Feedback:**
- Toast notifications for success/error (use Shadcn Toaster)
- Loading spinners for long operations
- Empty states with helpful messages
- Error boundaries to gracefully handle failures

### 6.3 Accessibility

- Keyboard navigation throughout
- ARIA labels on all buttons/icons
- Color-coding + text labels (not color alone for status)
- Responsive font sizes
- Focus visible states

---

## 7. Security Considerations

### 7.1 RBAC Protection

All `/admin/*` routes must:
1. Check user is authenticated (middleware already handles this via NextAuth)
2. Check user has `admin` role (new middleware check)
3. Return 401 if not authenticated, 403 if not admin

```javascript
// Middleware to add to auth.js or new middleware.js
export async function checkAdminRole(session) {
  if (!session?.user) return false;
  return session.user.role === 'admin';
}
```

### 7.2 API Route Security

All `/api/admin/*` routes must:
1. Validate authentication + admin role
2. Validate request params with Zod
3. Log security-relevant actions (role changes, deletions)
4. Rate-limit if possible (prevent abuse)

### 7.3 Audit Trail

Every admin action should be logged:
- User ID who performed action
- Action type (CREATE, UPDATE, DELETE)
- Entity type and ID
- Changes made (before/after)
- Timestamp

**This is already provided by `AuditLog` model** — just ensure admin pages log their mutations.

### 7.4 Secrets & Sensitive Data

- **Never display** full API keys, passwords, or tokens
- **Mask sensitive fields:** Email partially, password fields as asterisks
- **No logs leaking** secrets in error messages
- **Pagination prevents** bulk data exports via API

---

## 8. Performance & Scalability

### 8.1 API Pagination

All list endpoints return paginated results:
```json
{
  "data": [...],
  "total": 500,
  "page": 1,
  "pageSize": 20,
  "hasNextPage": true
}
```

### 8.2 Database Indexes

Ensure Prisma schema has optimal indexes for admin queries:
- `User` — Already indexed by `email`, `createdAt`
- `Job` — Already indexed by `queue`, `status`, `runAt`
- `File` — Already indexed by `uploadedById`, `mimeType`, `createdAt`
- `AuditLog` — Already indexed by `userId`, `action`, `entity`, `createdAt`

✅ **All required indexes are in place.**

### 8.3 Caching

For read-heavy pages (User list, Job status):
- Cache in-memory with short TTL (5 seconds) using `@techstream/quark-core/cache`
- Invalidate on create/update mutations
- Keep list queries fast even with millions of records

---

## 9. Customization & Extensibility

### 9.1 Developers Can:

1. **Add custom admin pages:**
   ```javascript
   // apps/web/src/app/admin/products/page.js
   import { checkAdminRole } from '@yourapp/api/middleware';
   
   export default async function ProductsAdminPage() {
     // Query your domain models, display custom admin UI
   }
   ```

2. **Extend existing pages:**
   ```javascript
   // Override admin/users/page.js with custom logic
   // Keep role/permission checks, add domain-specific columns
   ```

3. **Hide admin UI:**
   ```javascript
   // Delete /admin routes entirely if not needed
   // Or add env var: ENABLE_ADMIN_UI=false
   ```

4. **Customize styling:**
   ```css
   /* Override Tailwind classes in apps/web/globals.css */
   .admin-sidebar { }
   ```

### 9.2 No Core Package Changes Required

Admin UI lives entirely in scaffolded code — developers have full control.

---

## 10. Trade-offs & Considerations

### 10.1 Pros

| Benefit | Impact |
|---------|--------|
| **Out-of-the-box visibility** | New projects get immediate insight into system state |
| **Reduces operational burden** | No need to write basic admin UI; covers the 80% case |
| **Consistent patterns** | All Quark projects use same admin design |
| **Security built-in** | RBAC + audit logging come standard |
| **Extensible** | Easy for developers to customize or add features |
| **Minimal dependencies** | Uses existing tech stack (Shadcn, Tailwind, Zod) |
| **Learning tool** | New developers see best-practice patterns |

### 10.2 Cons

| Limitation | Mitigation |
|-----------|-----------|
| **Not a full CMS** | Developers extend for domain-specific admin |
| **Read-focused** | Bulk operations limited; most changes via API/app |
| **Assumes Quark models** | Doesn't help if projects don't use User/Job/File |
| **Scaffolding bloat** | Optional to include in project; can be deleted |
| **Role-based only** | No fine-grained permission system (by design) |
| **English-only UI** | Translations can be added per-project |

### 10.3 Design Decisions Explained

| Decision | Why |
|----------|-----|
| **Sidebar navigation** | Familiar pattern; scales well for many sections |
| **Table-centric UI** | Best for viewing/filtering structured data |
| **RBAC (role only)** | Simple, covers 95% of cases; can extend locally |
| **No custom DSL** | Use Shadcn + Tailwind; developers already know it |
| **Server Actions** | Matches Next.js 16 best practices; no extra API layer needed |
| **Pagination over export** | Security + performance (prevent bulk data leaks) |

---

## 11. Implementation Checklist

### Phase 1: MVP (2-3 weeks estimated)

- [ ] Create `/app/admin/layout.js` with sidebar navigation
- [ ] Implement Dashboard overview page with stat cards
- [ ] Add Users page with table, search, edit modal
- [ ] Add Jobs page with filter and status display
- [ ] Add Files browser page
- [ ] Add Audit Log viewer page
- [ ] Create `/api/admin/*` API routes with Zod validation
- [ ] Add RBAC middleware check
- [ ] Create shared Shadcn components (DataTable, StatCard, etc.)
- [ ] Write tests for admin middleware + API routes
- [ ] Document admin UI in `docs/ADMIN_UI.md`
- [ ] Update CLI to include admin in template
- [ ] Add optional feature flag to disable admin UI

### Phase 2: Polish & Edge Cases (1 week)

- [ ] Add caching to list endpoints
- [ ] Implement bulk actions (user roles, job retry/cancel)
- [ ] Add advanced filtering (date ranges, complex queries)
- [ ] Dark mode and responsive design refinement
- [ ] Error handling + edge case testing
- [ ] Performance optimization (lazy loading, pagination)
- [ ] Accessibility audit

### Phase 3: Optional Enhancements

- [ ] Admin settings page (if domain needs it)
- [ ] Export functionality (CSV for audit logs)
- [ ] Real-time updates (WebSocket for job status)
- [ ] Search across all entities
- [ ] Custom admin page scaffolding command
- [ ] Multi-tenancy admin (per-workspace UI)

---

## 12. Recommendation

### ✅ PROCEED with Admin UI Implementation

**Rationale:**

1. **Solves a real need:** Every Quark project needs operational visibility; manual solutions currently force developers to build their own admin.

2. **Aligns with Quark's architecture:** Infrastructure features (User, Job, File, AuditLog) are scaffolded, not published. Admin UI manages these core models following the same pattern.

3. **Minimal scope:** The proposed feature set is lean (5 pages), uses existing tech, and doesn't require new dependencies.

4. **Developer experience:** Projects get immediate visibility into system health without extra work; developers can customize or disable as needed.

5. **Zero breaking changes:** Admin UI is additive to existing projects; scaffolded into new ones as optional local code.

6. **Extensible:** Design allows developers to add domain-specific admin pages using the same patterns.

### Implementation Sequence

1. **Start** with MVP dashboard + Users + Jobs management (highest impact, lowest complexity)
2. **Add** Files and Audit Log pages (round out core infrastructure visibility)
3. **Iterate** based on feedback from internal testing
4. **Release** in next Quark version with full documentation

### Success Criteria

- ✅ New projects have operational dashboard out of the box
- ✅ Zero configuration required; just scaffold and see data
- ✅ All admin features are RBAC-protected
- ✅ Documentation shows how to customize/extend
- ✅ No breaking changes to existing projects
- ✅ Minimal bundle size impact (<50KB gzipped)

---

## 13. Appendix: Example Component Sketches

### DataTable Component (Shadcn-based)

```javascript
// apps/web/src/app/admin/components/DataTable.js
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DataTable({
  columns,        // [{ key, label, sortable, render }]
  data,           // array of objects
  isLoading,
  pageInfo,       // { page, pageSize, total }
  onPageChange,
  onSort,
  rowActions,     // (row) => ReactNode
}) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead 
                key={col.key}
                className={col.sortable ? 'cursor-pointer' : ''}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                {col.label}
              </TableHead>
            ))}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center">
                No data
              </TableCell>
            </TableRow>
          ) : (
            data.map(row => (
              <TableRow key={row.id}>
                {columns.map(col => (
                  <TableCell key={col.key}>
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
                <TableCell>{rowActions?.(row)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t">
        <div className="text-sm text-gray-600">
          Page {pageInfo.page} of {Math.ceil(pageInfo.total / pageInfo.pageSize)}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onPageChange(pageInfo.page - 1)}
            disabled={pageInfo.page === 1}
            variant="outline"
            size="sm"
          >
            <ChevronLeft /> Prev
          </Button>
          <Button
            onClick={() => onPageChange(pageInfo.page + 1)}
            disabled={!pageInfo.hasNextPage}
            variant="outline"
            size="sm"
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### StatCard Component

```javascript
// apps/web/src/app/admin/components/StatCard.js
export function StatCard({ title, value, icon: Icon, trend, color = 'blue' }) {
  return (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last week
            </p>
          )}
        </div>
        {Icon && <Icon className={`w-12 h-12 text-${color}-500`} />}
      </div>
    </div>
  );
}
```

### API Route Example

```javascript
// apps/web/src/app/api/admin/users/route.js
import { auth } from '@/lib/auth';
import { prisma } from '@yourapp/db';
import { z } from 'zod';

const ListUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
});

export async function GET(request) {
  const session = await auth();
  
  // Check admin role
  if (!session?.user || session.user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse + validate query params
  const params = ListUsersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  // Build query filters
  const where = {};
  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.role) {
    where.role = params.role;
  }

  // Fetch data + count
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id, email, name, role, createdAt },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return Response.json({
    data: users,
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasNextPage: (params.page * params.pageSize) < total,
  });
}
```

---

## Conclusion

A minimal admin UI is a **valuable addition** to Quark that solves real operational needs while respecting the framework's philosophy of local control. The proposed design is lean, extensible, and uses existing technology. Implementation can begin immediately with high confidence it will ship value.

**Next Step:** Review this proposal, approve scope, and begin Phase 1 (MVP) implementation.

---

*Prepared by: GitHub Copilot*  
*Framework: Quark (@techstream/quark-core + quark-create-app)*  
*Technology Stack: Next.js 16, Prisma 7, Shadcn UI, Tailwind CSS*
