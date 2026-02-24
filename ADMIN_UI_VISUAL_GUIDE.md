# Quark Admin UI — Visual & Reference Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUARK PROJECT (Scaffolded)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────┐       │
│  │   apps/web           │         │ apps/worker          │       │
│  │  (Next.js 16)        │         │ (BullMQ Worker)      │       │
│  │                      │         │                      │       │
│  │  ┌────────────────┐  │         │ Processes jobs from  │       │
│  │  │ /app/admin/*   │  │         │ Redis queue          │       │
│  │  │ (PAGES)        │◄─┼─────────┤                      │       │
│  │  ├────────────────┤  │         └──────────────────────┘       │
│  │  │ /api/admin/*   │  │                                        │
│  │  │ (ENDPOINTS)◄───┼──┤─────┐                                 │
│  │  ├────────────────┤  │     │                                 │
│  │  │ /api/auth/*    │  │     │                                 │
│  │  │ /api/files/*   │  │     │                                 │
│  │  │ /api/users/*   │  │     │                                 │
│  │  └────────────────┘  │     │                                 │
│  └──────────────────────┘     │                                 │
│           ↓                    │                                 │
│  ┌──────────────────────┐     │                                 │
│  │ packages/db          │     │                                 │
│  │ (Prisma Client)      │     │                                 │
│  └──────────────────────┘     │                                 │
│           ↓                    │                                 │
├─────────────┼────────┬────────┼────────────────────────────────┤
│  PostgreSQL │        │        │                                 │
│  Database   │        │    ┌───┴────────┐                       │
│             │        │    │ Redis      │ (Sessions, Cache)     │
│  • Users    │        │    │ Queue      │                       │
│  • Jobs     │        │    │            │                       │
│  • Files    │        └────────────────┘                        │
│  • Audit    │                                                   │
│             │    ┌──────────────────────────┐                  │
│             └────┤ @techstream/quark-core   │                  │
│                  │ (Auth, RBAC, Errors)     │                  │
│                  └──────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Admin UI Routes & Data Flow

```
CLIENT (Browser)
    │
    ├─→ GET /admin
    │   ↓
    │   [Next.js Layout]
    │   • Auth check (session required)
    │   • RBAC check (admin role required)
    │   • Render sidebar + page
    │   └─→ [Admin Dashboard]
    │
    ├─→ GET /admin/users
    │   ↓
    │   [Next.js Page Component]
    │   ↓
    │   Fetch: GET /api/admin/users?page=1&search=&role=
    │   ↓
    │   [API Route Handler]
    │   ├─ Validate session + admin role
    │   ├─ Validate query params (Zod)
    │   ├─ Query Prisma DB
    │   └─ Return paginated users JSON
    │   ↓
    │   [DataTable Component]
    │   ↓
    │   (User clicks "Edit User")
    │   ├─ Open dialog
    │   ├─ User modifies form
    │   └─ Post: PATCH /api/admin/users/:id (Server Action)
    │       ├─ Validate auth + RBAC
    │       ├─ Validate form data (Zod)
    │       ├─ Update user in Prisma DB
    │       ├─ Log audit event
    │       └─ Revalidate page
    │
    ├─→ GET /admin/jobs
    │   ↓
    │   Fetch: GET /api/admin/jobs?page=1&status=PENDING
    │   ↓
    │   [JobTable with Status Badges]
    │   ↓
    │   (User clicks "Retry Failed Job")
    │   └─ Post: PATCH /api/admin/jobs/:id/retry
    │
    ├─→ GET /admin/audit-logs
    │   ↓
    │   Fetch: GET /api/admin/audit-logs?page=1&user=&days=30
    │   ↓
    │   [AuditLogTable + Details Modal]
    │
    └─→ GET /admin/files
        ↓
        Fetch: GET /api/admin/files?page=1&mimeType=image
        ↓
        [FileBrowser with Delete Actions]
```

---

## Database Schema: Admin-Relevant Models

```
┌──────────────────────────────────────────┐
│                 User                      │
├──────────────────────────────────────────┤
│ id        String @id @default(cuid())    │
│ email     String @unique                 │ ← Admin searches, filters
│ name      String?                        │
│ role      String @default("viewer")      │ ← Admin manages (admin-only)
│ password  String?                        │
│ image     String?                        │
│ createdAt DateTime @default(now())       │ ← Used for sorting
│ updatedAt DateTime @updatedAt            │
│ ├─ accounts: Account[]                  │
│ ├─ sessions: Session[]                  │
│ ├─ files: File[]                        │
│ ├─ auditLogs: AuditLog[]                │
│ └─ indexed: [email, createdAt]          │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│                  Job                      │
├──────────────────────────────────────────┤
│ id           String @id                  │
│ queue        String                      │ ← Displayed, filtered
│ name         String                      │
│ data         Json?                       │ ← Shown in detail modal
│ status       JobStatus                   │ ← PENDING, IN_PROGRESS,
│ error        String?                     │   COMPLETED, FAILED
│ attempts     Int                         │ ← Retry count
│ maxRetries   Int                         │
│ runAt        DateTime                    │ ← Next run time
│ startedAt    DateTime?                   │ ← Actual start
│ completedAt  DateTime?                   │ ← Completion time
│ createdAt    DateTime @default(now())    │
│ ├─ indexed: [queue, status, runAt,       │
│ │            status+runAt, createdAt]    │
│ └─ (All indices optimized for admin)     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│                  File                     │
├──────────────────────────────────────────┤
│ id               String @id              │
│ filename         String                  │ ← Displayed
│ originalName     String                  │ ← User-friendly name
│ mimeType         String                  │ ← Filtered by type
│ size             Int                     │ ← Displayed (formatted)
│ storageKey       String @unique          │
│ storageProvider  String                  │
│ uploadedById     String?  (fk)           │ ← Link to User
│ createdAt        DateTime @default(now())│ ← Sorted
│ updatedAt        DateTime @updatedAt     │
│ └─ indexed: [uploadedById, mimeType,     │
│              createdAt]                  │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│                AuditLog                   │
├──────────────────────────────────────────┤
│ id       String @id                      │
│ userId   String (fk)                     │ ← Who did the action
│ action   String                          │ ← CREATE, UPDATE, DELETE
│ entity   String                          │ ← User, Product, Order
│ entityId String                          │ ← Which record
│ changes  Json?                           │ ← Before/after values
│ metadata Json?                           │ ← Additional context
│ createdAt DateTime @default(now())       │ ← Displayed, filtered
│ └─ indexed: [userId, action, entity,     │
│              createdAt]                  │
└──────────────────────────────────────────┘
```

---

## Admin Page Hierarchy

```
/admin (Protected Layout)
│
├─ Sidebar Navigation
│  ├─ Overview
│  ├─ Users
│  ├─ Jobs
│  ├─ Files
│  ├─ Audit Logs
│  └─ Settings
│
└─ Content Area (varies by page)
   │
   ├─ /admin (GET)
   │  Dashboard Overview
   │  ├─ [Stat Card] Total Users: 47
   │  ├─ [Stat Card] Active Sessions: 12
   │  ├─ [Stat Card] Pending Jobs: 3 (danger)
   │  ├─ [Stat Card] Failed Jobs: 1 (danger)
   │  ├─ System Health: ✅ API, ✅ DB, ✅ Redis
   │  └─ Recent Audit: [ActivityList]
   │
   ├─ /admin/users (GET)
   │  User Management
   │  ├─ [SearchInput] Filter by email/name
   │  ├─ [RoleSelect] Filter by role
   │  ├─ [DataTable] Columns: Email, Name, Role, Created, Actions
   │  │  ├─ Sortable columns (click header)
   │  │  ├─ Pagination (20 per page)
   │  │  └─ Row actions: [Edit] [Delete] [Reset Password]
   │  └─ (User clicks "Edit")
   │     → [Modal: Edit User Form]
   │        ├─ Name (text input)
   │        ├─ Email (text input)
   │        ├─ Role (select: admin | editor | viewer)
   │        └─ [Save] [Cancel]
   │
   ├─ /admin/jobs (GET)
   │  Job Queue Monitor
   │  ├─ [QueueSelect] Filter by queue name
   │  ├─ [StatusSelect] Filter: All, Pending, In Progress, Completed, Failed
   │  ├─ [DataTable] Columns: Queue, Job, Status, Created, Started, Duration
   │  │  ├─ Row status badge: 🟡 🔵 🟢 🔴
   │  │  └─ Row actions: [Details] [Retry] [Cancel]
   │  └─ (User clicks "Details")
   │     → [Modal: Job Details]
   │        ├─ Job name, queue, status
   │        ├─ Attempts: 2/3
   │        ├─ Data: {JSON Viewer}
   │        ├─ Error: {Error message}
   │        └─ [Retry] [Cancel] [Close]
   │
   ├─ /admin/files (GET)
   │  File Browser
   │  ├─ [MimeTypeSelect] Filter by type (images, documents, etc.)
   │  ├─ [DataTable] Columns: Filename, Type, Size, Uploaded By, Date
   │  │  ├─ Sortable by name, size, date
   │  │  └─ Row actions: [Download] [Preview] [Delete]
   │  └─ (User clicks "Delete")
   │     → [Confirmation Dialog]
   │        └─ "Delete 'document.pdf'?" [Delete] [Cancel]
   │
   ├─ /admin/audit-logs (GET)
   │  Audit Log Viewer
   │  ├─ [UserSelect] Filter by user
   │  ├─ [ActionSelect] Filter: All, CREATE, UPDATE, DELETE
   │  ├─ [DaysSelect] Filter: Last 7, 30, 90 days
   │  ├─ [DataTable] Columns: User, Action, Entity, Entity ID, Time
   │  │  ├─ Action badges: CREATE (green), UPDATE (blue), DELETE (red)
   │  │  └─ Row actions: [View Details]
   │  └─ (User clicks "View Details")
   │     → [Modal: Change Details]
   │        ├─ Before: {JSON}
   │        ├─ After: {JSON}
   │        └─ Metadata display
   │
   └─ /admin/settings (GET)
      Admin Settings (Optional)
      ├─ Max file upload size: [Input] MB
      ├─ Allowed file types: [TagInput] .pdf .doc .jpg ...
      ├─ Job retention: [Select] 7 days, 30 days, 90 days, forever
      ├─ Email notifications: [Toggle] On/Off
      └─ [Save] [Reset]
```

---

## Security & RBAC Flow

```
User visits /admin
    ↓
[Middleware: Check Authentication]
    ├─ Session exists? NO → Redirect to /auth/signin
    └─ Session exists? YES → Continue
    ↓
[Middleware: Check Admin Role]
    ├─ user.role === 'admin'? NO → 403 Forbidden
    └─ user.role === 'admin'? YES → Render page
    ↓
[Page loads: GET /api/admin/users?page=1]
    ↓
[API Handler Auth Check]
    ├─ Validate session token
    ├─ Validate user.role === 'admin'
    └─ User passes? YES → Fetch data, NO → Return 403
    ↓
[Database Query]
    ├─ SELECT users with pagination
    ├─ Limit to 20 per page
    └─ Order by createdAt DESC
    ↓
[Response]
    ├─ { data, total, page, pageSize, hasNextPage }
    └─ Sent to client
    ↓
[User clicks "Edit User Role"]
    ↓
[Modal Form Submission]
    ├─ Collect form data: { name, email, role }
    ├─ Validate with Zod schema
    └─ Call Server Action: updateUser(id, data)
    ↓
[Server Action Handler]
    ├─ Re-check auth + admin role
    ├─ Validate input again (Zod)
    ├─ Execute PATCH /api/admin/users/:id
    │   └─ Prisma: user.update({ data })
    ├─ Log audit event: { userId, action: 'UPDATE', entity: 'User', changes }
    └─ Return success → Toast notification
```

---

## Component Tree Example (Users Page)

```
UsersPage
├─ Layout (admin/layout.js - RBAC protection)
│  └─ Sidebar
│     ├─ NavLink("Overview", "/admin")
│     ├─ NavLink("Users", "/admin/users") [ACTIVE]
│     ├─ NavLink("Jobs", "/admin/jobs")
│     ├─ NavLink("Files", "/admin/files")
│     ├─ NavLink("Audit Logs", "/admin/audit-logs")
│     └─ NavLink("Settings", "/admin/settings")
│
└─ Main Content
   ├─ PageHeader
   │  ├─ Title: "Users"
   │  └─ Description: "Manage user accounts and roles"
   │
   ├─ FilterBar
   │  ├─ SearchInput (email/name filter)
   │  ├─ RoleSelect (admin|editor|viewer filter)
   │  └─ [Clear] button
   │
   ├─ DataTable
   │  ├─ Header row (sortable columns)
   │  ├─ Body rows
   │  │  └─ UserRow
   │  │     ├─ Email cell
   │  │     ├─ Name cell
   │  │     ├─ Role: [RoleBadge]
   │  │     ├─ Created: DateTime
   │  │     └─ Actions: [EditButton] [DeleteButton] [ResetPasswordButton]
   │  │        └─ (Click Edit)
   │  │           └─ EditUserDialog
   │  │              ├─ Form
   │  │              │  ├─ [Input] Name
   │  │              │  ├─ [Input] Email
   │  │              │  └─ [Select] Role
   │  │              └─ [Submit] [Cancel]
   │  │
   │  └─ Pagination
   │     ├─ "Page 1 of 5"
   │     └─ [Prev] [Next] buttons
   │
   └─ EmptyState (if no users)
      ├─ Icon
      ├─ "No users found"
      └─ [Create User] button (future)
```

---

## API Response Examples

### GET /api/admin/users?page=1&search=john&role=admin

**Request:**
```
GET /api/admin/users?page=1&pageSize=20&search=john&role=admin
Authorization: Bearer <session-token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "user_123",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "admin",
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "total": 47,
  "page": 1,
  "pageSize": 20,
  "hasNextPage": true
}
```

**Error Response (403 Forbidden):**
```json
{
  "error": "Forbidden",
  "message": "Admin role required"
}
```

---

### PATCH /api/admin/users/:id

**Request:**
```
PATCH /api/admin/users/user_123
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "role": "editor",
  "name": "John Smith"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated",
  "data": {
    "id": "user_123",
    "email": "john.doe@example.com",
    "name": "John Smith",
    "role": "editor"
  }
}
```

---

### GET /api/admin/jobs?status=FAILED&page=1

**Request:**
```
GET /api/admin/jobs?page=1&pageSize=20&status=FAILED&queue=email
Authorization: Bearer <session-token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "job_456",
      "queue": "email",
      "name": "send-welcome-email",
      "status": "FAILED",
      "data": {
        "userId": "user_789",
        "email": "test@example.com"
      },
      "error": "SMTP connection timeout after 30s",
      "attempts": 3,
      "maxRetries": 3,
      "createdAt": "2026-02-23T08:15:00Z",
      "startedAt": "2026-02-23T08:16:00Z",
      "completedAt": "2026-02-23T08:16:45Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNextPage": false
}
```

---

## File Structure Summary

```
apps/web/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── layout.js                   # Sidebar + RBAC check
│   │   │   ├── page.js                     # Dashboard
│   │   │   ├── users/
│   │   │   │   └── page.js
│   │   │   ├── jobs/
│   │   │   │   └── page.js
│   │   │   ├── files/
│   │   │   │   └── page.js
│   │   │   ├── audit-logs/
│   │   │   │   └── page.js
│   │   │   ├── settings/
│   │   │   │   └── page.js
│   │   │   └── components/
│   │   │       ├── DataTable.js            # Reusable table
│   │   │       ├── StatCard.js             # Metric card
│   │   │       ├── StatusBadge.js          # Color-coded badge
│   │   │       ├── Sidebar.js              # Navigation
│   │   │       ├── UserForm.js             # Edit user dialog
│   │   │       ├── JobModal.js             # Job details
│   │   │       └── ...
│   │   ├── api/
│   │   │   └── admin/
│   │   │       ├── users/
│   │   │       │   └── route.js            # GET list, PATCH user
│   │   │       ├── jobs/
│   │   │       │   └── route.js            # GET list, PATCH actions
│   │   │       ├── files/
│   │   │       │   └── route.js            # GET list, DELETE file
│   │   │       └── audit-logs/
│   │   │           └── route.js            # GET list + details
│   │   └── ... (existing pages)
│   ├── lib/
│   │   ├── auth/
│   │   ├── admin/
│   │   │   ├── permissions.js              # checkAdminRole()
│   │   │   ├── formatters.js               # formatFileSize, etc.
│   │   │   └── schemas.js                  # Zod validation schemas
│   │   └── ... (existing utils)
│   └── ...
└── ...

packages/ui/
├── src/
│   ├── button.js                   # Already exists
│   ├── ... (Shadcn components used by admin)
│   └── ...
```

---

## Implementation Timeline (Estimated)

```
Week 1 (Mon-Fri)
├─ Day 1: Layout + Navigation structure, auth middleware
├─ Day 2: Dashboard page with stat cards
├─ Day 3: Users page + API routes
└─ Day 4-5: Jobs + Files pages

Week 2 (Mon-Fri)
├─ Day 1-2: Audit logs page + modals for detail views
├─ Day 2-3: Edit dialogs, form validation, error handling
├─ Day 3-4: Testing (unit + integration)
└─ Day 5: Documentation + code review

Week 3 (Mon-Fri)
├─ Day 1-2: Polish + refinements from feedback
├─ Day 2-3: Performance optimization, caching
├─ Day 3-4: Accessibility audit, responsive design
└─ Day 5: Release preparation + changelog

Added: Week 4 (Mon-Fri) — Polish Phase (optional)
├─ Bulk actions (select multiple rows)
├─ Advanced filtering (date ranges, complex queries)
├─ Real-time updates
└─ Export functionality
```

---

## Key Takeaways

| Aspect | Decision |
|--------|----------|
| **Where** | Scaffolded into `apps/web` (local, not in core package) |
| **Access** | Protected by RBAC (admin role required) |
| **Scope** | Infrastructure-focused (User, Job, File, AuditLog) |
| **Extensibility** | Easy to add custom admin pages |
| **Tech** | Next.js, Prisma, Shadcn, Tailwind (all existing) |
| **Effort** | ~3 weeks MVP, ~1 week polish |
| **Risk Level** | Low (additive only, no breaking changes) |
| **Optional** | Yes (can be deleted if not needed) |

---

*End of Visual Guide*  
*For detailed specifications, see [ADMIN_UI_PROPOSAL.md](./ADMIN_UI_PROPOSAL.md)*
