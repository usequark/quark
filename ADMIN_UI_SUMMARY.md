# Quark Admin UI — Executive Summary

## Overview

**Request:** Review feasibility and design of a default minimal admin UI for Quark projects.

**Status:** ✅ **RECOMMENDED FOR IMPLEMENTATION**

**Estimated Effort:** 2-3 weeks (MVP) + 1 week (polish)

**Impact:** Provides operational visibility to all Quark projects; enables teams to manage users, jobs, files, and audit logs from day one.

---

## Key Findings

### Current Gap
- New Quark projects have **no built-in admin interface**
- Developers manually build custom dashboards or use third-party tools
- Core infrastructure (users, jobs, audit logs) is invisible without custom tooling

### Opportunity
Quark's architecture is **perfect** for an admin UI:
- Core models already exist (User, Account, Session, File, Job, AuditLog)
- RBAC framework in place (`@techstream/quark-core/authorization.js`)
- Tech stack fully supports it (Next.js, Prisma, Shadcn, Tailwind)
- All projects share the same infrastructure layer

### Design Philosophy
**Local + Infrastructure Split**
- **Registry:** Core utilities (auth, queues, validation)
- **Scaffolded locally:** Admin UI pages and routes
- **Result:** Full developer control; optional to use

---

## Proposed Features (MVP)

| Feature | Purpose | Complexity |
|---------|---------|-----------|
| **Dashboard** | System health snapshot (user count, job status, recent logs) | Low |
| **Users Management** | View/edit users, manage roles, reset passwords | Low |
| **Job Monitor** | Visibility into BullMQ queue (pending/failed/completed) | Medium |
| **Files Browser** | View uploaded files, delete, download metadata | Low |
| **Audit Log Viewer** | Track all system changes for compliance | Low |
| **Admin Settings** | Optional page for app-specific configuration | Low |

---

## Technical Architecture

### Location
```
apps/web/
├── src/app/admin/                    # Pages + components
│   ├── page.js                       # Dashboard
│   ├── users/page.js                 # User management
│   ├── jobs/page.js                  # Job monitor
│   ├── files/page.js                 # File browser
│   ├── audit-logs/page.js            # Audit viewer
│   └── layout.js                     # Sidebar nav + RBAC check
└── src/app/api/admin/                # API endpoints
    ├── users/route.js
    ├── jobs/route.js
    ├── files/route.js
    └── audit-logs/route.js
```

### Security Model
- ✅ **Protected by RBAC:** Requires `admin` role
- ✅ **No password reset:** Send reset email only
- ✅ **Read-heavy:** Minimal mutations (fewer security vectors)
- ✅ **Audit logging:** All admin actions logged
- ✅ **Rate limited:** Prevent brute force attacks

### Tech Stack (Reuses Existing)
- Next.js 16 (App Router, Server Actions)
- Prisma ORM + PostgreSQL
- NextAuth v5 (authentication)
- Shadcn UI (pre-built components)
- Tailwind CSS (styling)
- Zod (validation)

---

## Visual Design

### Layout
```
┌──────────────────────────────────────────────┐
│  Quark Admin              [user@example] [↪]  │
├───────────────┬──────────────────────────────┤
│ Overview      │  📊 Dashboard                │
│ Users         │  • Total Users: 42           │
│ Jobs          │  • Pending Jobs: 3           │
│ Files         │  • Failed Jobs: 1            │
│ Audit Logs    │  • Recent Activity...        │
│ Settings      │                              │
└───────────────┴──────────────────────────────┘
```

### Component Palette
- Sidebar navigation (collapsible on mobile)
- Data tables with sorting, filtering, pagination
- Stat cards showing key metrics
- Modal dialogs for forms (edit user, view job details)
- Status badges (Pending 🟡, In Progress 🔵, Completed 🟢, Failed 🔴)
- Toast notifications (success/error feedback)

---

## Trade-offs

### Pros ✅
| Benefit | Why It Matters |
|---------|---|
| **Zero setup** | Projects get admin UI automatically |
| **Consistency** | All Quark apps use same patterns |
| **Extensible** | Easy for developers to customize |
| **Security built-in** | RBAC + audit logging included |
| **No bloat** | Minimal dependencies (uses existing tech) |
| **Best practice reference** | Teaches developers Quark patterns |

### Cons ⚠️
| Limitation | How to Address |
|-----------|---|
| **Not a CMS** | Developers extend for domain models |
| **Infrastructure-only** | By design; domain logic stays local |
| **Optional** | Can be deleted if not needed |
| **English UI** | Translations added per-project if needed |
| **Scaffolding size** | ~50KB gzipped; minimal impact |

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-3)
- ✅ Dashboard with stat cards
- ✅ Users table + edit dialog
- ✅ Jobs monitor with status filtering
- ✅ Files browser
- ✅ Audit log viewer
- ✅ RBAC middleware + API routes
- ✅ Documentation

### Phase 2: Polish (Week 4)
- ✅ Caching for performance
- ✅ Bulk actions (user roles, job retry/cancel)
- ✅ Dark mode + responsive design
- ✅ Error handling + accessibility
- ✅ Unit & integration tests

### Phase 3: Optional Enhancements (Future)
- Dashboard customization
- Real-time updates (WebSocket)
- Export functionality (CSV)
- Multi-tenancy support
- Custom admin page scaffolding CLI

---

## Success Criteria

| Criterion | Definition |
|-----------|-----------|
| **Usability** | New users can navigate and find what they need in <5 min |
| **Performance** | Pages load in <1s; tables handle 10k+ records |
| **Security** | Zero unauthorized access; all admin actions logged |
| **Extensibility** | Developers can add custom pages easily |
| **No friction** | Works out-of-the-box; no configuration needed |
| **Minimal size** | <50KB gzipped; doesn't bloat bundle |

---

## Recommendation Summary

### ✅ PROCEED

**Rationale:**
1. **Solves a real problem** — Every Quark project needs operational visibility
2. **Aligns with Quark philosophy** — Infrastructure features scaffolded locally
3. **Low risk** — Additive only; no breaking changes
4. **High value** — 80% of admin UIs are similar (CRUD tables + dashboards)
5. **Fully extensible** — Developers can customize or disable
6. **Zero new dependencies** — Uses existing tech stack

**Next Step:** Approve Phase 1 scope and begin MVP implementation.

---

## Appendix: Comparison with Alternatives

### Option 1: No Admin UI (Current State)
- ❌ Teams build custom solutions repeatedly
- ❌ No consistency across Quark projects
- ❌ Operational blind spot

### Option 2: Admin UI in Core Package (Registry)
- ❌ Strongly couples UI to infrastructure
- ❌ Updates break user customizations
- ❌ Forces all projects into same admin mold

### Option 3: Admin UI in Scaffolded Templates ✅ **RECOMMENDED**
- ✅ Full local control
- ✅ Easy to customize or remove
- ✅ Aligns with Quark's Core-Only Registry model
- ✅ Consistency without rigidity

### Option 4: Separate Admin Package (@techstream/quark-admin)
- ❌ Adds complexity to monorepo
- ❌ Requires extra npm package
- ❌ Still needs local customization anyway

---

## Questions & Clarifications

### Q: Will this bloat scaffolded projects?
**A:** No. Admin UI is ~500 lines of code + components. If not needed, it can be deleted in seconds.

### Q: What about multi-language support?
**A:** MVP is English-only. Developers extending it can add i18n per their needs (Quark doesn't mandate translations).

### Q: Can projects opt-out?
**A:** Yes. Delete `/app/admin` and `/app/api/admin` folders. Or use env var `ENABLE_ADMIN_UI=false` to disable routes.

### Q: Does this work for custom domain models?
**A:** Admin UI handles Quark core models only (User, Job, File, AuditLog). Developers add custom admin pages alongside.

### Q: What about permission granularity?
**A:** MVP uses simple role-based access (`admin` role). Fine-grained permissions can be added locally per project.

### Q: Performance with large datasets?
**A:** All endpoints paginate results (20 per page). Database indexes are in place. Caching can reduce API calls 5x.

---

## Document Reference

**Full Technical Proposal:** See [ADMIN_UI_PROPOSAL.md](./ADMIN_UI_PROPOSAL.md)

- Sections 1-12 contain detailed architecture, feature specs, implementation checklist, and code examples.
- Section 13 (Appendix) has example React component sketches.

---

*Prepared for:* Quark Project Leadership  
*Date:* February 23, 2026  
*Status:* Ready for Approval & Implementation  
*Framework:* Quark v2.x.x (@techstream/quark-core + quark-create-app)
