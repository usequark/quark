# Phase 2: Admin Package — Implementation Plan

## Overview

Scaffold `packages/admin/` as a local workspace package via the CLI. Self-scaling CRUD admin UI that reads the Prisma schema at runtime, discovers all models automatically, and generates list/detail/create pages using the existing UI primitives.

**No new npm dependencies.** No published package. Pure scaffolded code owned by the project.

---

## Architecture

Two pieces, cleanly separated:

| Piece | Location | Purpose | JSX? |
|-------|----------|---------|------|
| **Admin package** | `packages/admin/` | Pure JS utilities: introspection, generic queries, field mapping, config | No |
| **Admin routes** | `apps/web/src/app/admin/` | Next.js App Router pages + components using `@<app>/admin` + `@<app>/ui` | Yes |

The admin package is a utility library with zero React dependency. All rendering lives in the route files, where Next.js handles JSX transpilation naturally.

### Why this split?

- `packages/admin/` stays framework-agnostic — pure JS, testable with `node --test`, no transpiler needed
- Route files live in `apps/web/` where JSX works natively via Next.js
- Follows the existing pattern: `packages/db/` (utilities) → `apps/web/src/app/api/` (routes that use them)

---

## Template Strategy

### Two template directories

```
packages/cli/templates/
  admin/          ← from packages/admin/ (utility package)
  admin-routes/   ← from apps/web/src/app/admin/ (route files)
```

This mirrors how `jobs` + `worker` are paired: selecting `jobs` scaffolds both `packages/jobs/` and `apps/worker/`.

### CLI scaffolding flow (when admin is selected)

```
1. Copy templates/admin/     → packages/admin/
2. Copy templates/admin-routes/ → apps/web/src/app/admin/
3. Update package.json names with user's scope
4. replaceImportsInSourceFiles handles @techstream/quark-admin → @<scope>/admin
5. patchNextConfig keeps @<scope>/admin in transpilePackages
```

### Sync configuration additions

```javascript
// sync-templates.js — new SYNC_DIRS entries
{ src: "packages/admin", dest: "admin" },
{ src: "apps/web/src/app/admin", dest: "admin-routes" },

// New EXCLUDE_PATTERNS entry (prevent admin routes from leaking into base-project)
/^apps\/web\/src\/app\/admin\//,

// New TRANSFORMS entry
"admin/package.json": transformOptionalPackageJson,
```

---

## File Tree

### `packages/admin/` (new — monorepo source)

```
packages/admin/
  package.json
  src/
    index.js              Main exports
    introspect.js         DMMF reader — returns model metadata
    introspect.test.js    Tests for introspection
    query.js              Generic CRUD via dynamic Prisma client access
    query.test.js         Tests for query helpers (needs Postgres)
    field-map.js          Maps Prisma field types → input component types
    field-map.test.js     Tests for field mapping
    config.js             Admin configuration (hidden fields, read-only fields, labels)
```

### `apps/web/src/app/admin/` (new — monorepo reference)

```
apps/web/src/app/admin/
  layout.js               Auth guard + admin shell (sidebar + content)
  page.js                 Dashboard — model counts, recent activity
  [model]/
    page.js               List view — table with pagination
    [id]/
      page.js             Edit view — form pre-filled with record data
    new/
      page.js             Create view — empty form
  _actions/
    crud.js               Server Actions for create, update, delete
  _components/
    Sidebar.js            Model navigation sidebar (Server Component)
    ModelTable.js          Records table with links (Server Component)
    ModelForm.js           Create/edit form (Client Component — interactive)
    FieldRenderer.js       Renders correct input per field type (Client Component)
```

### Modified files

```
packages/cli/scripts/sync-templates.js    Add SYNC_DIRS, EXCLUDE, TRANSFORMS for admin
packages/cli/src/index.js                 Add admin-routes scaffolding step
packages/db/src/client.js                 Re-export Prisma DMMF accessor (if needed)
pnpm-workspace.yaml                       Add packages/admin to workspaces (if not glob-matched)
apps/web/package.json                     Add @techstream/quark-admin workspace dep
```

---

## Detailed File Specifications

### 1. `packages/admin/package.json`

```json
{
  "name": "@techstream/quark-admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "dependencies": {}
}
```

No dependencies. Admin uses imports from `@<app>/db` (Prisma client + DMMF) — these are workspace refs wired by the CLI.

### 2. `packages/admin/src/index.js`

Re-exports everything:

```javascript
export * from "./introspect.js";
export * from "./query.js";
export * from "./field-map.js";
export * from "./config.js";
```

### 3. `packages/admin/src/introspect.js`

**Purpose:** Read Prisma DMMF and return structured model metadata.

**DMMF access strategy (requires verification during implementation):**

| Priority | Method | Notes |
|----------|--------|-------|
| 1 | `Prisma.dmmf.datamodel.models` | Public API in prisma-client-js. Verify availability in Prisma 7 `prisma-client` generator. |
| 2 | Import from generated client directory | `import { Prisma } from '@<app>/db'` if re-exported |
| 3 | `prisma._baseDmmf` or `prisma._dmmf` | Internal API — fragile but proven |
| 4 | Parse `schema.prisma` file directly | Last resort — regex-based, no dependency |

**Implementation must verify which method works with Prisma 7's `prisma-client` generator before writing code.**

**Exports:**

```javascript
/**
 * Returns all model definitions from the Prisma DMMF.
 * @param {object} dmmf - Prisma DMMF object (datamodel section)
 * @returns {Array<{ name: string, fields: Field[], dbName: string|null }>}
 */
export function getModels(dmmf) { ... }

/**
 * Returns a single model definition by name (case-insensitive match).
 * @param {object} dmmf - Prisma DMMF object
 * @param {string} name - Model name (e.g. "User", "user")
 * @returns {{ name: string, fields: Field[] } | undefined}
 */
export function getModel(dmmf, name) { ... }

/**
 * Returns all enum definitions from the DMMF.
 * @param {object} dmmf - Prisma DMMF object
 * @returns {Array<{ name: string, values: string[] }>}
 */
export function getEnums(dmmf) { ... }

/**
 * Converts a model name to a URL slug.
 * "User" → "user", "AuditLog" → "auditlog"
 * @param {string} name
 * @returns {string}
 */
export function modelToSlug(name) { ... }

/**
 * Finds a model by its URL slug (reverse of modelToSlug).
 * @param {object} dmmf
 * @param {string} slug
 * @returns {{ name: string, fields: Field[] } | undefined}
 */
export function getModelBySlug(dmmf, slug) { ... }
```

**Field shape returned:**

```javascript
{
  name: "email",         // Field name
  type: "String",        // Prisma type (String, Int, DateTime, Boolean, Json, enum name, model name)
  kind: "scalar",        // "scalar" | "object" | "enum"
  isList: false,
  isRequired: true,
  isId: false,
  isReadOnly: false,     // e.g. createdAt with @default(now())
  hasDefaultValue: false,
  isUnique: true,
  relationName: null,    // Set for relation fields
  documentation: null,   // From /// comments in schema
}
```

### 4. `packages/admin/src/query.js`

**Purpose:** Generic CRUD operations using dynamic Prisma client model access (`prisma[modelName]`).

```javascript
/**
 * Fetch paginated records for a model.
 * @param {PrismaClient} prisma
 * @param {string} model - Lowercase model name (e.g. "user")
 * @param {{ skip?: number, take?: number, orderBy?: object }} options
 */
export async function findMany(prisma, model, options = {}) {
  const { skip = 0, take = 25, orderBy = { createdAt: "desc" } } = options;
  const delegate = getDelegate(prisma, model);
  const [records, total] = await Promise.all([
    delegate.findMany({ skip, take, orderBy }),
    delegate.count(),
  ]);
  return { records, total, skip, take };
}

/**
 * Fetch a single record by ID.
 */
export async function findById(prisma, model, id) {
  return getDelegate(prisma, model).findUnique({ where: { id } });
}

/**
 * Create a new record.
 */
export async function createRecord(prisma, model, data) {
  return getDelegate(prisma, model).create({ data });
}

/**
 * Update a record by ID.
 */
export async function updateRecord(prisma, model, id, data) {
  return getDelegate(prisma, model).update({ where: { id }, data });
}

/**
 * Delete a record by ID.
 */
export async function deleteRecord(prisma, model, id) {
  return getDelegate(prisma, model).delete({ where: { id } });
}

/**
 * Count all records for a model.
 */
export async function countRecords(prisma, model) {
  return getDelegate(prisma, model).count();
}

/**
 * Get the Prisma delegate for a model name.
 * Handles case normalization: "User" → prisma.user, "AuditLog" → prisma.auditLog
 */
function getDelegate(prisma, model) {
  // Prisma delegates use lowerCamelCase: User → user, AuditLog → auditLog
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  const delegate = prisma[key];
  if (!delegate) {
    throw new Error(`Unknown model: ${model}`);
  }
  return delegate;
}
```

**Key design decisions:**
- Accepts `prisma` as a parameter (not imported) — testable, no circular deps
- Delegate lookup uses lowerCamelCase (Prisma convention)
- `findMany` returns `{ records, total, skip, take }` for pagination
- Default sort by `createdAt desc` (every Quark model has `createdAt`)

### 5. `packages/admin/src/field-map.js`

**Purpose:** Map Prisma field types to input component types for the admin form.

```javascript
const FIELD_TYPE_MAP = {
  String: "text",
  Int: "number",
  Float: "number",
  Decimal: "number",
  BigInt: "number",
  Boolean: "checkbox",
  DateTime: "datetime-local",
  Json: "json",        // Renders as Textarea with JSON formatting
};

/**
 * Returns the HTML input type for a Prisma field.
 * @param {Field} field - Field from introspect.js
 * @returns {"text"|"number"|"checkbox"|"datetime-local"|"select"|"textarea"|"json"|"relation"|"hidden"}
 */
export function getInputType(field) {
  // Hidden: IDs, system timestamps
  if (field.isId || isSystemField(field)) return "hidden";

  // Sensitive: password fields
  if (isSensitiveField(field)) return "hidden";

  // Enums → select dropdown
  if (field.kind === "enum") return "select";

  // Relations → handled separately (relation select or hidden)
  if (field.kind === "object") return "relation";

  // Email heuristic
  if (field.name === "email" && field.type === "String") return "email";

  // Long text heuristic
  if (field.type === "String" && isLongTextField(field)) return "textarea";

  return FIELD_TYPE_MAP[field.type] || "text";
}

/**
 * Returns true if the field should be visible in list (table) view.
 */
export function isListVisible(field) {
  if (field.kind === "object") return false;    // Skip relations in table
  if (field.type === "Json") return false;       // Too large for table cell
  if (isSensitiveField(field)) return false;
  return true;
}

/**
 * Returns true if the field should be editable in forms.
 */
export function isEditable(field) {
  if (field.isId) return false;
  if (field.isReadOnly) return false;
  if (isSystemField(field)) return false;
  if (field.kind === "object") return false;
  if (isSensitiveField(field)) return false;
  return true;
}

function isSystemField(field) {
  return ["createdAt", "updatedAt"].includes(field.name) && field.hasDefaultValue;
}

function isSensitiveField(field) {
  return ["password", "hashedPassword", "secret", "token"].includes(field.name);
}

function isLongTextField(field) {
  return ["description", "content", "body", "notes", "bio", "summary"].includes(field.name);
}
```

### 6. `packages/admin/src/config.js`

**Purpose:** Default admin configuration. Users modify this after scaffolding to customize labels, hide fields, etc.

```javascript
/**
 * Default admin configuration.
 * Override per-model settings by editing this file after scaffolding.
 *
 * @type {AdminConfig}
 */
export const adminConfig = {
  /** Title shown in the admin header */
  title: "Admin",

  /** Number of records per page in list views */
  pageSize: 25,

  /** Fields hidden globally (never shown in any model) */
  hiddenFields: ["password", "hashedPassword"],

  /** Fields that are read-only in forms (shown but not editable) */
  readOnlyFields: ["id", "createdAt", "updatedAt"],

  /**
   * Per-model overrides. Key is the Prisma model name.
   * @example
   * modelOverrides: {
   *   User: { hiddenFields: ["password"], displayField: "email" },
   *   AuditLog: { readOnly: true },
   * }
   */
  modelOverrides: {},
};
```

### 7. `apps/web/src/app/admin/layout.js` (Server Component)

```javascript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./_components/Sidebar";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- Auth check via `auth()` (NextAuth session) + role check
- Redirect to home if not admin (not an error page — better UX)
- Sidebar + content layout

### 8. `apps/web/src/app/admin/page.js` (Dashboard)

```javascript
import { prisma } from "@techstream/quark-db";
import { getModels, getDmmf, countRecords } from "@techstream/quark-admin";
import { Card, CardHeader, CardTitle, CardContent } from "@techstream/quark-ui";

export default async function AdminDashboard() {
  const dmmf = getDmmf();
  const models = getModels(dmmf);

  // Fetch counts for all models in parallel
  const counts = await Promise.all(
    models.map(async (model) => ({
      name: model.name,
      count: await countRecords(prisma, model.name),
    }))
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {counts.map(({ name, count }) => (
          <a key={name} href={`/admin/${name.toLowerCase()}`}>
            <Card>
              <CardHeader>
                <CardTitle>{name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-sm text-gray-500">records</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
```

### 9. `apps/web/src/app/admin/[model]/page.js` (List View)

Server Component. Reads the model slug from params, fetches paginated records, renders a table.

```javascript
import { prisma } from "@techstream/quark-db";
import { getModelBySlug, getDmmf, findMany } from "@techstream/quark-admin";
import { notFound } from "next/navigation";
import ModelTable from "../_components/ModelTable";

export default async function ModelListPage({ params, searchParams }) {
  const { model: slug } = await params;
  const { page } = await searchParams;

  const dmmf = getDmmf();
  const model = getModelBySlug(dmmf, slug);
  if (!model) notFound();

  const currentPage = Math.max(1, parseInt(page) || 1);
  const pageSize = 25;
  const { records, total } = await findMany(prisma, model.name, {
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{model.name}</h1>
        <a href={`/admin/${slug}/new`}>
          <Button>Create {model.name}</Button>
        </a>
      </div>
      <ModelTable model={model} records={records} slug={slug} />
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-4">
          {currentPage > 1 && <a href={`/admin/${slug}?page=${currentPage - 1}`}>← Previous</a>}
          <span>Page {currentPage} of {totalPages}</span>
          {currentPage < totalPages && <a href={`/admin/${slug}?page=${currentPage + 1}`}>Next →</a>}
        </div>
      )}
    </div>
  );
}
```

### 10. `apps/web/src/app/admin/[model]/[id]/page.js` (Edit View)

```javascript
import { prisma } from "@techstream/quark-db";
import { getModelBySlug, getDmmf, findById } from "@techstream/quark-admin";
import { notFound } from "next/navigation";
import ModelForm from "../../_components/ModelForm";

export default async function EditRecordPage({ params }) {
  const { model: slug, id } = await params;

  const dmmf = getDmmf();
  const model = getModelBySlug(dmmf, slug);
  if (!model) notFound();

  const record = await findById(prisma, model.name, id);
  if (!record) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit {model.name}</h1>
      <ModelForm model={model} record={record} slug={slug} />
    </div>
  );
}
```

### 11. `apps/web/src/app/admin/[model]/new/page.js` (Create View)

```javascript
import { getModelBySlug, getDmmf } from "@techstream/quark-admin";
import { notFound } from "next/navigation";
import ModelForm from "../../_components/ModelForm";

export default async function NewRecordPage({ params }) {
  const { model: slug } = await params;

  const dmmf = getDmmf();
  const model = getModelBySlug(dmmf, slug);
  if (!model) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Create {model.name}</h1>
      <ModelForm model={model} slug={slug} />
    </div>
  );
}
```

### 12. `apps/web/src/app/admin/_actions/crud.js` (Server Actions)

```javascript
"use server";

import { prisma } from "@techstream/quark-db";
import { createRecord, updateRecord, deleteRecord, getModelBySlug, getDmmf, isEditable } from "@techstream/quark-admin";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function adminCreate(slug, formData) {
  await requireAdmin();
  const dmmf = getDmmf();
  const model = getModelBySlug(dmmf, slug);
  if (!model) throw new Error("Unknown model");

  const data = extractFormData(model, formData);
  await createRecord(prisma, model.name, data);
  revalidatePath(`/admin/${slug}`);
  redirect(`/admin/${slug}`);
}

export async function adminUpdate(slug, id, formData) {
  await requireAdmin();
  const dmmf = getDmmf();
  const model = getModelBySlug(dmmf, slug);
  if (!model) throw new Error("Unknown model");

  const data = extractFormData(model, formData);
  await updateRecord(prisma, model.name, id, data);
  revalidatePath(`/admin/${slug}`);
  redirect(`/admin/${slug}`);
}

export async function adminDelete(slug, id) {
  await requireAdmin();
  const dmmf = getDmmf();
  const model = getModelBySlug(dmmf, slug);
  if (!model) throw new Error("Unknown model");

  await deleteRecord(prisma, model.name, id);
  revalidatePath(`/admin/${slug}`);
  redirect(`/admin/${slug}`);
}

/**
 * Extract and coerce form data based on model field types.
 * Only includes editable fields — ignores IDs, system timestamps, etc.
 */
function extractFormData(model, formData) {
  const data = {};
  for (const field of model.fields) {
    if (!isEditable(field)) continue;
    const value = formData.get(field.name);
    if (value === null || value === undefined) continue;
    data[field.name] = coerceValue(field, value);
  }
  return data;
}

function coerceValue(field, value) {
  switch (field.type) {
    case "Int":
    case "Float":
    case "Decimal":
    case "BigInt":
      return Number(value);
    case "Boolean":
      return value === "on" || value === "true";
    case "DateTime":
      return new Date(value);
    case "Json":
      return JSON.parse(value);
    default:
      return value === "" ? null : value;
  }
}
```

**Key design decisions:**
- **Server Actions** (not API routes) — modern Next.js pattern, less boilerplate
- **`requireAdmin()`** — local inline check (admin layout already guards, but defense in depth)
- **`revalidatePath`** — ensures list view updates after mutations
- **`redirect`** — sends user back to list after create/update
- **`extractFormData`** — type coercion from FormData strings to Prisma types
- **No Zod validation** — The CRUD operations are generic (schema is dynamic). Field-level type coercion + Prisma's own validation provide safety. Adding Zod would require dynamic schema generation which adds complexity without proportional safety gain for an admin-only tool.

### 13. `_components/Sidebar.js` (Server Component)

```javascript
import { getModels, getDmmf, modelToSlug } from "@techstream/quark-admin";

export default function Sidebar() {
  const dmmf = getDmmf();
  const models = getModels(dmmf);

  return (
    <aside className="w-56 border-r bg-gray-50 p-4">
      <a href="/admin" className="block text-lg font-bold mb-4">Admin</a>
      <nav className="flex flex-col gap-1">
        {models.map((model) => (
          <a
            key={model.name}
            href={`/admin/${modelToSlug(model.name)}`}
            className="px-3 py-2 rounded hover:bg-gray-200 text-sm"
          >
            {model.name}
          </a>
        ))}
      </nav>
    </aside>
  );
}
```

### 14. `_components/ModelTable.js` (Server Component)

Uses `Table` from `@<app>/ui`. Renders visible fields as columns, records as rows.

```javascript
import { isListVisible } from "@techstream/quark-admin";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from "@techstream/quark-ui";

export default function ModelTable({ model, records, slug }) {
  const visibleFields = model.fields.filter(isListVisible);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visibleFields.map((field) => (
            <TableHead key={field.name}>{field.name}</TableHead>
          ))}
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            {visibleFields.map((field) => (
              <TableCell key={field.name}>{formatValue(record[field.name], field)}</TableCell>
            ))}
            <TableCell>
              <a href={`/admin/${slug}/${record.id}`}>
                <Button variant="outline" size="sm">Edit</Button>
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatValue(value, field) {
  if (value === null || value === undefined) return "—";
  if (field.type === "DateTime") return new Date(value).toLocaleDateString();
  if (field.type === "Boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.length > 50) return value.slice(0, 50) + "…";
  return String(value);
}
```

### 15. `_components/ModelForm.js` (Client Component)

```javascript
"use client";

import { adminCreate, adminUpdate, adminDelete } from "../_actions/crud";
import FieldRenderer from "./FieldRenderer";
import { isEditable } from "@techstream/quark-admin";
import { Button } from "@techstream/quark-ui";

export default function ModelForm({ model, record, slug }) {
  const editableFields = model.fields.filter(isEditable);
  const isEdit = !!record;

  return (
    <form action={isEdit
      ? (formData) => adminUpdate(slug, record.id, formData)
      : (formData) => adminCreate(slug, formData)
    }>
      <div className="space-y-4 max-w-lg">
        {editableFields.map((field) => (
          <FieldRenderer key={field.name} field={field} value={record?.[field.name]} />
        ))}
      </div>
      <div className="flex gap-2 mt-6">
        <Button type="submit">{isEdit ? "Save" : "Create"}</Button>
        <a href={`/admin/${slug}`}><Button variant="outline" type="button">Cancel</Button></a>
        {isEdit && (
          <Button
            variant="destructive"
            type="button"
            onClick={() => { if (confirm("Delete this record?")) adminDelete(slug, record.id); }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
```

### 16. `_components/FieldRenderer.js` (Client Component)

```javascript
"use client";

import { getInputType } from "@techstream/quark-admin";
import { Input, Select, Checkbox, Label, Textarea } from "@techstream/quark-ui";

export default function FieldRenderer({ field, value }) {
  const inputType = getInputType(field);

  if (inputType === "hidden") return null;

  return (
    <div>
      <Label htmlFor={field.name}>{field.name}{field.isRequired && " *"}</Label>
      {renderInput(field, inputType, value)}
    </div>
  );
}

function renderInput(field, inputType, value) {
  const name = field.name;
  const required = field.isRequired && !field.hasDefaultValue;

  switch (inputType) {
    case "checkbox":
      return <Checkbox id={name} name={name} defaultChecked={!!value} />;
    case "select":
      // Enum fields — options come from field metadata
      return (
        <Select id={name} name={name} defaultValue={value || ""} required={required}>
          <option value="">Select...</option>
          {(field.enumValues || []).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
      );
    case "textarea":
    case "json":
      return (
        <Textarea
          id={name}
          name={name}
          defaultValue={inputType === "json" ? JSON.stringify(value, null, 2) : (value || "")}
          required={required}
          rows={5}
        />
      );
    default:
      return (
        <Input
          id={name}
          name={name}
          type={inputType}
          defaultValue={formatDefaultValue(value, inputType)}
          required={required}
        />
      );
  }
}

function formatDefaultValue(value, inputType) {
  if (value === null || value === undefined) return "";
  if (inputType === "datetime-local" && value instanceof Date) {
    return value.toISOString().slice(0, 16);
  }
  return String(value);
}
```

---

## CLI Changes

### `packages/cli/src/index.js`

**Add admin-routes scaffolding** (in Step 6, alongside the worker scaffolding):

```javascript
// If admin selected, also scaffold admin routes into apps/web
if (features.includes("admin")) {
  const adminRoutesDir = path.join(targetDir, "apps/web/src/app/admin");
  await fs.ensureDir(adminRoutesDir);
  await copyTemplate("admin-routes", adminRoutesDir);
  console.log(chalk.green(`    ✓ admin routes (paired with admin)`));
}
```

**Existing wiring already handles:**
- ✅ `admin` feature flag registered (`["ui", "jobs", "admin"]`)
- ✅ `admin` requires `ui` (auto-includes if missing)
- ✅ `@<scope>/admin` scope mapping
- ✅ `transpilePackages` patching via `patchNextConfig`
- ✅ `replaceImportsInSourceFiles` includes "admin" in workspace packages
- ✅ Graceful skip if template directory doesn't exist

**New:** Need to ensure `@<scope>/admin` is added as a workspace dependency in `apps/web/package.json` when admin is selected. Check if the existing CLI handles this or if it needs addition.

### `packages/cli/scripts/sync-templates.js`

Add to `SYNC_DIRS`:
```javascript
{ src: "packages/admin", dest: "admin" },
{ src: "apps/web/src/app/admin", dest: "admin-routes" },
```

Add to `EXCLUDE_PATTERNS`:
```javascript
/^apps\/web\/src\/app\/admin\//,
```

Add to `TRANSFORMS`:
```javascript
"admin/package.json": transformOptionalPackageJson,
```

---

## DMMF Access — Implementation Spike

**This is the single biggest technical risk.** Before writing any admin code, verify DMMF access with Prisma 7's `prisma-client` generator.

### Spike checklist

1. In the monorepo, check if `Prisma.dmmf` is available:
   ```javascript
   import { Prisma } from "./src/generated/prisma/client.ts";
   console.log(Prisma.dmmf?.datamodel?.models);
   ```
2. If not, check the generated directory for static DMMF files:
   ```bash
   ls packages/db/src/generated/prisma/
   ```
3. If no static DMMF, check runtime access:
   ```javascript
   import { prisma } from "@techstream/quark-db";
   console.log(prisma._dmmf || prisma._baseDmmf);
   ```
4. Document the working method and any version constraints.

**The `getDmmf()` function in `introspect.js` will encapsulate whichever method works, so the rest of the admin code doesn't depend on Prisma internals.**

---

## What Self-Scaling Means

"Self-scaling" = **add a model to `schema.prisma`, run `prisma generate`, refresh browser → admin page appears automatically.**

This works because:
1. DMMF is read at request time (not build time)
2. `[model]` catch-all route handles any model name
3. Sidebar renders all models from DMMF
4. ModelTable and ModelForm render fields dynamically from model metadata
5. Generic query functions work with any model name via `prisma[modelName]`

No code generation step. No CLI command to run. Just edit schema → generate → refresh.

---

## Testing Strategy

### Unit tests (in `packages/admin/`)

| File | Tests |
|------|-------|
| `introspect.test.js` | Parse DMMF fixture → correct model list, field shapes, slug mapping |
| `query.test.js` | CRUD operations via Prisma (requires Postgres) — findMany pagination, findById, create, update, delete, count |
| `field-map.test.js` | Input type mapping, visibility rules, editability rules, sensitive field detection |

Test DMMF fixtures can be generated from the existing schema by calling `getDmmf()` once and saving the output.

### Integration tests

Route-level tests are optional for Phase 2. The admin is an internal tool — unit tests on the utilities + manual QA is sufficient. Integration tests for admin routes can be added in a later phase if needed.

---

## Implementation Order

```
Step 1: DMMF spike — verify access method
Step 2: packages/admin/ — introspect.js + tests
Step 3: packages/admin/ — field-map.js + tests
Step 4: packages/admin/ — query.js + tests
Step 5: packages/admin/ — config.js + index.js + package.json
Step 6: apps/web/src/app/admin/ — layout.js + Sidebar
Step 7: apps/web/src/app/admin/ — dashboard page
Step 8: apps/web/src/app/admin/ — [model]/page.js (list view) + ModelTable
Step 9: apps/web/src/app/admin/ — _actions/crud.js + ModelForm + FieldRenderer
Step 10: apps/web/src/app/admin/ — [model]/[id]/page.js + [model]/new/page.js
Step 11: CLI — sync-templates.js + index.js changes
Step 12: Run sync-templates, lint, test
Step 13: Manual QA — verify self-scaling behavior
```

Steps 2–5 can be done first (pure JS, fully testable). Steps 6–10 depend on steps 2–5. Step 11 depends on all source files existing.

---

## What's NOT in Phase 2

- **Search/filter** — list view shows paginated records only. Filtering is Phase 2.5 or a user customization.
- **Relation editing** — FK fields show the ID value. Relation select dropdowns are a future enhancement.
- **Bulk actions** — no multi-select, no bulk delete/update.
- **Audit logging** — admin CRUD operations are not logged to AuditLog. Can be added by users.
- **Custom actions** — no model-specific action buttons. Users extend ModelForm after scaffolding.
- **Dark mode** — admin uses light Tailwind classes only. Users add dark mode via UI component `theme` prop.
- **Multi-tenant** — mentioned in PLAN.md as a CLI flag. Separate from admin, not in scope.

These omissions are intentional — the admin is a starting point that users customize. Shipping less is better than shipping fragile abstractions.
