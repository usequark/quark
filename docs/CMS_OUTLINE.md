# Quark CMS — Design Outline

> A content management system built on the same principles as the Admin package:
> schema-driven, scaffolded-and-owned, zero external CMS dependencies.

## Philosophy

The Quark CMS is **not Strapi, not Payload, not WordPress**. It follows the Quark pattern:

- **Schema-driven** — Content types are Prisma models. The CMS reads the schema, just like Admin reads it.
- **Scaffold-and-own** — The CMS package is scaffolded into your project. You own the code, the schema, the routes.
- **Admin-native** — CMS routes live under `/admin/cms/` and share the admin layout, auth guard, and sidebar.
- **No runtime content-type builder** — Content types are defined in `schema.prisma`, not in a web UI. Migrations are the source of truth.
- **Progressive** — Start with Pages. Add Blog Posts, Media Library, or custom content types as your schema grows.

## Architecture

### Package Structure

```
packages/cms/                    # New optional package (requires: admin + ui)
├── package.json
└── src/
    ├── index.js                 # Barrel export
    ├── config.js                # CMS configuration (editable by developer)
    ├── content-query.js         # Content-specific query helpers (extends admin/query.js)
    ├── slug.js                  # Slug generation + uniqueness validation
    ├── status.js                # Content status lifecycle (draft → published → archived)
    └── schema-fragment.prisma   # Reference schema — appended to user's schema on scaffold

apps/web/src/app/admin/cms/      # CMS routes (nested under admin layout)
├── page.js                      # CMS dashboard (content overview, recent drafts)
├── pages/                       # Page management
│   ├── page.js                  # List all pages
│   ├── [id]/page.js             # Edit page
│   └── new/page.js              # Create page
├── posts/                       # Blog post management (optional model)
│   ├── page.js
│   ├── [id]/page.js
│   └── new/page.js
├── media/                       # Media library
│   ├── page.js                  # Grid/list view of uploaded media
│   └── upload/page.js           # Upload flow
├── _actions/                    # Server Actions
│   ├── content.js               # Create/update/publish/archive content
│   └── media.js                 # Upload/delete media assets
└── _components/                 # CMS-specific UI components
    ├── ContentEditor.js          # Rich text editor wrapper (client component)
    ├── ContentTable.js           # Content list with status badges
    ├── MediaBrowser.js           # Media grid with preview + select
    ├── MediaUploader.js          # Drag-and-drop upload (client component)
    ├── SlugField.js              # Auto-slug from title with edit override
    ├── StatusBadge.js            # Draft/Published/Archived visual indicator
    └── ContentPreview.js         # Preview panel (side-by-side or fullscreen)
```

### Dependency Chain

```
cms → admin → ui → db
```

CLI enforcement: `quark add cms` auto-adds `admin` and `ui` if not present.

### Relationship to Admin

| Concern | Admin | CMS |
|---------|-------|-----|
| What it manages | All Prisma models (generic CRUD) | Content-specific models (Pages, Posts, Media) |
| Schema awareness | `introspect.js` parses all models | Reuses admin introspection + adds content-specific logic |
| Query layer | `query.js` — generic findMany/create/update/delete | `content-query.js` — extends with publish/archive/version/slug ops |
| Route location | `/admin/` | `/admin/cms/` (nested under admin layout) |
| Config | `adminConfig` — model overrides | `cmsConfig` — content types, editor settings, media config |
| Field rendering | `FieldRenderer.js` — generic inputs | `ContentEditor.js` — rich text with media embedding |

## Data Model

### Core Models (schema-fragment.prisma)

```prisma
/// CMS: Pages — static site content (about, contact, terms, etc.)
model Page {
  id          String      @id @default(cuid())
  title       String
  slug        String      @unique
  body        String      @db.Text
  excerpt     String?
  status      ContentStatus @default(DRAFT)
  publishedAt DateTime?
  authorId    String
  author      User        @relation(fields: [authorId], references: [id])
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([status])
  @@index([slug])
}

/// CMS: Blog posts (optional — remove if not needed)
model Post {
  id          String      @id @default(cuid())
  title       String
  slug        String      @unique
  body        String      @db.Text
  excerpt     String?
  coverImage  String?
  status      ContentStatus @default(DRAFT)
  publishedAt DateTime?
  authorId    String
  author      User        @relation(fields: [authorId], references: [id])
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([status, publishedAt])
  @@index([slug])
}

/// CMS: Media library — tracks uploaded files with metadata
model MediaAsset {
  id          String   @id @default(cuid())
  filename    String
  storageKey  String   @unique
  mimeType    String
  size        Int
  width       Int?
  height      Int?
  alt         String?
  uploadedById String
  uploadedBy  User     @relation(fields: [uploadedById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum ContentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### Design Decisions

- **No `ContentType` meta-model.** Content types are Prisma models, not runtime-defined. This keeps Quark's stance: schema is code, managed by migrations. Developers add new content types by adding models to `schema.prisma`.
- **No `version` column in v1.** Content versioning is a LARGE feature. v1 ships with `status` lifecycle only. Version history can be added later via an `ContentVersion` model with a relation to the parent.
- **`authorId` is required.** All content tracks who created it. The admin auth guard ensures a session exists.
- **`slug` is unique per model.** The `slug.js` utility auto-generates from title and validates uniqueness at the server action level.
- **`MediaAsset` uses `storageKey`.** This maps directly to `storage.put(key, ...)` from `@techstream/quark-core`. The CMS doesn't store files itself — it delegates to the existing storage adapter.

## Module Design

### `packages/cms/src/config.js`

```js
export const cmsConfig = {
  /**
   * Content types managed by the CMS.
   * Key: Prisma model name. Value: display config.
   * Only models listed here appear in the CMS sidebar.
   */
  contentTypes: {
    Page: {
      label: "Pages",
      icon: "file-text",       // Mapped to an icon in the sidebar
      slugSource: "title",     // Which field auto-generates the slug
      excerptField: "excerpt", // Optional summary field
    },
    Post: {
      label: "Blog Posts",
      icon: "pen-line",
      slugSource: "title",
      excerptField: "excerpt",
      hasCoverImage: true,
    },
  },

  /** Media library configuration */
  media: {
    /** Max upload size in bytes (default: 10MB) */
    maxFileSize: 10 * 1024 * 1024,
    /** Allowed MIME types */
    allowedTypes: [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
      "image/svg+xml", "application/pdf",
    ],
  },

  /** Editor configuration */
  editor: {
    /** Default editor mode: "rich" (WYSIWYG) or "markdown" */
    mode: "rich",
  },
};
```

### `packages/cms/src/content-query.js`

Extends the admin query pattern with content-specific operations:

```js
import { findMany, findById, createRecord, updateRecord } from "@scope/admin";

/** Publish a content record — sets status to PUBLISHED and publishedAt to now */
export async function publishContent(prisma, model, id) { ... }

/** Archive a content record — sets status to ARCHIVED */
export async function archiveContent(prisma, model, id) { ... }

/** Revert to draft — sets status to DRAFT, clears publishedAt */
export async function unpublishContent(prisma, model, id) { ... }

/** Find published content by slug */
export async function findBySlug(prisma, model, slug) { ... }

/** List content filtered by status, ordered by publishedAt or updatedAt */
export async function findContent(prisma, model, options) { ... }
```

### `packages/cms/src/slug.js`

```js
/** Generate a URL-safe slug from a title string */
export function generateSlug(title) { ... }

/** Check if a slug is unique for a model, append -N suffix if not */
export async function ensureUniqueSlug(prisma, model, slug, excludeId) { ... }
```

### `packages/cms/src/status.js`

```js
/** Valid status transitions */
const TRANSITIONS = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

/** Validate a status transition */
export function canTransition(from, to) { ... }

/** Apply a status transition with side effects (set publishedAt, etc.) */
export function applyTransition(record, newStatus) { ... }
```

## UI Components

### Rich Text Editor (`ContentEditor.js`)

**Approach:** The admin already has a `richtext` input type that uses a basic `contentEditable` div. The CMS replaces this with a proper editor.

**Options (choose one at scaffold time, own the code):**

1. **Tiptap** (recommended) — Headless, extensible, built on ProseMirror. Supports media embedding, markdown shortcuts, collaborative editing (future). MIT license. `~50KB gzipped`.
2. **Lexical** (alternative) — Meta's editor framework. More low-level, better for custom block editors. MIT. `~30KB gzipped`.

Both are scaffolded as source code in the CMS package, not installed as runtime dependencies. The developer owns the editor config.

**Editor features (v1):**
- Headings (H1-H3), bold, italic, links
- Ordered/unordered lists
- Block quotes
- Images (via Media Library integration — opens `MediaBrowser` modal)
- Code blocks
- Undo/redo

### Media Browser (`MediaBrowser.js`)

- Grid view of uploaded `MediaAsset` records
- Preview panel on selection
- Search by filename / filter by MIME type
- "Insert" action that returns the asset URL to the editor
- Uses `getAssetUrl()` from `@techstream/quark-core/storage` for URL resolution

### Media Uploader (`MediaUploader.js`)

- Drag-and-drop zone + file picker
- Client-side validation (size, type) before upload
- Progress indicator
- Calls server action → `storage.put()` → creates `MediaAsset` record
- For S3: uses `getSignedUploadUrl()` for direct browser upload (no server proxy)

### Slug Field (`SlugField.js`)

- Auto-generates slug from title on change (debounced)
- Allows manual override
- Shows uniqueness validation inline (calls server action to check)
- Displays the preview URL: `/{slug}`

## Server Actions (`_actions/content.js`)

```js
"use server";

import { z } from "zod";
import { auth } from "@scope/core/auth";
import { prisma } from "@scope/db";
import { publishContent, archiveContent, unpublishContent } from "@scope/cms";

const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  body: z.string(),
  excerpt: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export async function cmsCreatePage(formData) { ... }
export async function cmsUpdatePage(id, formData) { ... }
export async function cmsPublishPage(id) { ... }
export async function cmsArchivePage(id) { ... }
export async function cmsDeletePage(id) { ... }
```

All server actions follow Quark conventions: Zod validation, auth guard, `AppError` for failures.

## CLI Integration

### `quark add cms`

```
FEATURE_META update:
  cms: { requires: ["admin", "ui"], pairs: ["cms-routes"] }
```

**Scaffold steps:**
1. Copy `packages/cms/` template
2. Copy `apps/web/src/app/admin/cms/` routes
3. Append CMS models to `packages/db/prisma/schema.prisma`
4. Add `@scope/cms` to `transpilePackages` in `next.config.js`
5. Add `@scope/cms` dependency to `apps/web/package.json`
6. Run `pnpm install` + `pnpm db:generate`
7. Prompt: "Run `pnpm db:migrate` to apply the CMS schema changes"

### Template Sync

Add to `sync-templates.js`:

```js
SYNC_DIRS.push(
  { src: "packages/cms", dest: "cms" },
  { src: "apps/web/src/app/admin/cms", dest: "cms-routes" },
);
```

## Public API (Optional)

The CMS is for *managing* content in the admin. For *serving* content on the public site, developers write their own routes — Quark doesn't prescribe frontend rendering.

However, the CMS package exports query helpers usable in any Server Component:

```js
// app/[slug]/page.js — developer writes this
import { findBySlug } from "@scope/cms";
import { prisma } from "@scope/db";

export default async function DynamicPage({ params }) {
  const page = await findBySlug(prisma, "Page", params.slug);
  if (!page) notFound();
  return <article dangerouslySetInnerHTML={{ __html: page.body }} />;
}
```

**Note:** `dangerouslySetInnerHTML` requires the rich text editor to produce sanitized HTML. The `ContentEditor` should sanitize on save (server-side, via the server action), not on render.

## Implementation Phases

### Phase 1 — Core (MVP)

- [ ] `packages/cms/` package: config, content-query, slug, status
- [ ] Prisma schema fragment: Page, MediaAsset, ContentStatus enum
- [ ] CMS routes: Pages CRUD with status lifecycle
- [ ] Rich text editor (Tiptap, scaffolded as owned code)
- [ ] Media upload flow (using existing `storage.js`)
- [ ] CLI: `quark add cms` with schema append
- [ ] Template sync integration

### Phase 2 — Blog + Media Browser

- [ ] Post model and routes
- [ ] Media Browser component (grid, search, preview)
- [ ] Editor ↔ Media Browser integration (insert image from library)
- [ ] Cover image picker for Posts

### Phase 3 — Polish

- [ ] Content preview (side-by-side editor + rendered view)
- [ ] Bulk actions (publish/archive multiple)
- [ ] Scheduled publishing (`scheduledAt` field, worker job)
- [ ] Content search (full-text via Prisma or `pg_trgm`)

### Future (Not in Scope)

- Content versioning / revision history
- Collaborative editing
- Content type builder UI (goes against Quark philosophy — use Prisma schema)
- Multi-language / i18n content (use the `i18n` skill when needed)
- API/GraphQL content delivery layer

## Open Questions

1. **Rich text storage format:** Store as HTML (simpler, what the editor produces) or as a structured JSON document (ProseMirror/Lexical format — more flexible for future rendering)? Recommendation: **HTML** for v1, with server-side sanitization via DOMPurify.

2. **Editor dependency:** Scaffold Tiptap as vendored code (full ownership) or install as a `dependency` (simpler updates)? Recommendation: **Install as dependency** — editors are complex and benefit from upstream bug fixes. This is the one exception to "scaffold-and-own" because rich text editing is not a domain developers typically customize at the library level.

3. **Post model inclusion:** Should `Post` be scaffolded by default or opt-in? Recommendation: **Include by default** with a comment "remove this model if you don't need a blog." Easier to delete than to add.

4. **Admin sidebar integration:** Should CMS models appear in the main admin sidebar (alongside generic CRUD models) or in a separate "Content" section? Recommendation: **Separate "Content" section** in the sidebar with its own heading, visually distinct from the generic model list.
