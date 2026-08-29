> **Archived.** This spec describes a scaffolded package approach (`packages/i18n/`) that predates the skill-based architecture. The technical decisions (next-intl, prefix-based routing, CMS locale field) remain valid and should be referenced when building the i18n skill. The implementation approach (CLI transforms, `--features i18n`, template restructuring) is outdated.

# Quark i18n Integration

> Implementation-ready spec for adding internationalization (i18n) to Quark.
> Philosophy: opt-in, scaffold-and-own, minimal overhead. Use the best tool for Next.js App Router.

---

## 1. Library Choice: `next-intl`

| Criterion | next-intl | react-i18next | Lingui |
|---|---|---|---|
| App Router support | ✅ Native | ⚠️ Manual config | ✅ |
| Server Components | ✅ Native | ❌ Wrappers needed | ✅ |
| Middleware routing | ✅ Built-in | ❌ Manual | Manual |
| Type-safe keys | ✅ | ❌ Optional | ✅ |
| Bundle size | ~2 KB | ~8 KB | ~12 KB |
| Maintenance | Active | Declining | Active |
| Formatting (dates, numbers) | ✅ `Intl` wrappers | ✅ i18next | ✅ Lingui |

**Decision:** `next-intl` — purpose-built for Next.js App Router, native Server Component support, middleware-based locale negotiation, and minimal bundle impact.

---

## 2. Architecture Overview

### 2.1 Routing Strategy: Prefix-based

```
/                    → redirect to /en/ (via middleware)
/en/                 → English home
/es/                 → Spanish home
/en/about            → English about page
/es/acerca-de        → Spanish about page
```

- `localePrefix: 'always'` — all URLs include the locale prefix
- Future option: `localePrefix: 'as-needed'` to hide the default locale prefix
- Best for SEO (unique, shareable URLs per language variant)

### 2.2 Locale Detection Chain

```
1. URL path prefix      (/en/...)    → explicit user choice
2. Cookie (n-lang)      ← set by LocaleSwitcher component
3. Accept-Language      ← browser default
4. defaultLocale        ← configured fallback ("en")
```

### 2.3 Scope: What Lives Under `[locale]`

| Route | Under `[locale]`? | Reason |
|---|---|---|
| Home page | ✅ | Public-facing content |
| `[slug]` (CMS pages) | ✅ | Public-facing content |
| Future public pages | ✅ | Blog, pricing, etc. |
| Admin (`/admin`) | ❌ | Tooling, not content |
| Auth (`/auth`, `/login`) | ❌ | Transient flows |
| API (`/api`) | ❌ | Excluded by middleware matcher |

> Rationale: Admin and auth are tooling, not user-facing content. Keeping them outside `[locale]` avoids unnecessary complexity in sidebar navigation, auth redirects, and admin infrastructure. The Admin theme (`locale` field in ModelForm hints) still works for content models regardless.

### 2.4 File Structure

```
apps/web/src/
├── middleware.js              # NEW: locale detection
├── i18n/
│   ├── routing.js             # NEW: locale config + navigation
│   └── request.js             # NEW: request-scoped config
├── app/
│   ├── layout.js              # MODIFIED: thin wrapper, no html/body
│   ├── [locale]/
│   │   ├── layout.js          # MOVED: previous root layout content
│   │   ├── page.js            # MOVED: home page
│   │   ├── [slug]/
│   │   │   └── page.js        # MOVED: CMS page
│   │   └── ...                # future public pages
│   ├── admin/                 # STAYS: outside [locale]
│   ├── auth/                  # STAYS: outside [locale]
│   ├── api/                   # STAYS: outside [locale]
│   ├── global-error.js        # MODIFIED: dynamic lang
│   ├── sitemap.js             # MODIFIED: locale alternates
│   └── robots.js              # NO CHANGE
├── lib/
│   └── seo/
│       └── site-metadata.js   # MODIFIED: locale-aware metadata
messages/                      # NEW: translation files
├── en.json
└── es.json
```

---

## 3. Configuration Layer

### 3.1 Environment Variables

Add to `packages/config/src/validate-env.js`:

```js
DEFAULT_LOCALE: {
  required: false,
  description: 'Default locale code (default: "en")',
},
SUPPORTED_LOCALES: {
  required: false,
  description: 'Comma-separated locale codes (default: "en")',
},
```

### 3.2 Routing Config (`i18n/routing.js`)

```js
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

const SUPPORTED_LOCALES = (process.env.SUPPORTED_LOCALES || 'en')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || 'en';

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

export const defaultLocale = DEFAULT_LOCALE;
export const locales = SUPPORTED_LOCALES;
```

### 3.3 Request Config (`i18n/request.js`)

```js
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

---

## 4. Middleware

Create `apps/web/src/middleware.js`:

```js
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
```

The middleware handles:
- **Locale detection**: URL → cookie → Accept-Language → default
- **Redirect**: `/` → `/en/` (or matched locale)
- **Cookie persistence**: Sets `x-next-intl-locale` cookie on switch
- **hreflang `Link` headers**: Injects `Link: <...>; rel="alternate"; hreflang="..."` headers automatically for SEO
- **Locale header**: Attaches `x-next-intl-locale` for Server Components

---

## 5. Application Layer — Layout Restructuring

### 5.1 Root Layout (`app/layout.js`)

Becomes a thin pass-through — no `<html>` or `<body>`:

```js
import { routing } from '../i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function RootLayout({ children }) {
  return children;
}
```

> Next.js requires only one `<html>` and `<body>` element, rendered by the deepest layout that provides them. The `[locale]/layout.js` takes that responsibility.

### 5.2 Locale Layout (`app/[locale]/layout.js`)

Moved from `app/layout.js` with locale awareness:

```js
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getUmamiConfig } from '@/lib/analytics/umami-config';
import { getSiteMetadata } from '@/lib/seo/site-metadata';
import './globals.css';

const themeScript = `(function(){...})()`;
const umamiBeforeSendScript = `window.__umamiBeforeSend=...`;

export function generateMetadata({ params }) {
  return getSiteMetadata(params?.locale);
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const umamiConfig = getUmamiConfig();

  return (
    <html lang={locale} dir={getDir(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: umamiBeforeSendScript }} />
        {umamiConfig.enabled ? (/* umami preconnect/link/script */) : null}
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        {umamiConfig.enabled ? <UmamiWebVitals /> : null}
        {umamiConfig.replayEnabled ? <UmamiReplayRecorder /> : null}
      </body>
    </html>
  );
}

function getDir(locale) {
  return ['ar', 'he', 'fa', 'ur'].includes(locale?.split('-')[0]) ? 'rtl' : 'ltr';
}
```

### 5.3 `global-error.js`

Update `<html lang="en">` to use `defaultLocale`:

```js
import { routing } from '../i18n/routing';

export default function GlobalError({ error, reset }) {
  return (
    <html lang={routing.defaultLocale}>
      {/* ... */}
    </html>
  );
}
```

---

## 6. Navigation & Links

### 6.1 Locale-Aware Navigation

All internal navigation must use locale-aware wrappers:

```js
// ❌ Before:
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ✅ After:
import { Link, redirect, usePathname, useRouter } from '@/i18n/routing';
```

**Files to update** (all public-facing pages/components):

| File | Change |
|---|---|
| `apps/web/src/app/[locale]/page.js` | Use `@/i18n/routing` imports |
| `apps/web/src/app/[locale]/[slug]/page.js` | Use `@/i18n/routing` imports |
| `packages/ui/src/navbar.js` | Accept locale-aware Link as prop or use generic `<a>` |
| `packages/ui/src/footer.js` | Same |

**Template files** (same changes mirrored):
| File | Change |
|---|---|
| `packages/cli/templates/cms-public/app/[locale]/[slug]/page.js` | i18n imports |
| `packages/cli/templates/cms-public/app/[locale]/[slug]/_components/*` | i18n imports |

### 6.2 Public Navigation Strategy

The `<Navbar>` and `<Footer>` components in `packages/ui/` are Server Component-safe but don't import from `next/link` directly — they accept `Link` components as children or render `<a>` tags. This means:

- **Without i18n**: `<Navbar>` uses standard `<a>` or accepts `Link` from parent
- **With i18n**: Parent passes locale-aware `Link` from `@/i18n/routing`

No changes needed to the UI package internals for navigation.

---

## 7. Translation System

### 7.1 Message Files (`messages/{locale}.json`)

Namespaced by component/page:

```json
{
  "common": {
    "site_name": "Quark",
    "footer_copyright": "© {year} Quark. All rights reserved.",
    "loading": "Loading..."
  },
  "home": {
    "title": "Welcome to Quark",
    "subtitle": "Build production-ready web apps faster",
    "cta": "Get Started"
  },
  "nav": {
    "home": "Home",
    "admin": "Admin",
    "login": "Sign In",
    "logout": "Sign Out"
  },
  "errors": {
    "not_found_title": "Page Not Found",
    "not_found_body": "The page you're looking for doesn't exist."
  }
}
```

### 7.2 Translation File Conventions

| Convention | Rule |
|---|---|
| Key format | Namespaced dot notation: `component.field` |
| Interpolation | `{variable}` (ICU MessageFormat) |
| Pluralization | `{count, plural, one {...} other {...}}` |
| Numbers | Use `Intl.NumberFormat` directly, not message-level formatting |
| Dates | Use `Intl.DateTimeFormat` directly |
| Default locale | English (`en`) — always fully populated |
| Fallback chain | `es-MX` → `es` → `en` |
| Translation tool | None in v1 — hand-edited JSON files |

### 7.3 Type Safety

Type declaration for IDE autocompletion (in `i18n/request.js` or a `.d.ts`):

```js
// The default messages file defines the type shape
const messages = (await import(`../../messages/${locale}.json`)).default;
```

Future enhancement: `next-intl` supports ahead-of-time message compilation and SWC plugin integration for type-safe keys in `useTranslations()`.

---

## 8. UI Layer — Locale Switcher

### 8.1 Component: `LocaleSwitcher`

A client component that switches locales without full page reload:

```jsx
'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales, localeDisplayNames } from '@/i18n/routing';
import { useLocale } from 'next-intl';

export function LocaleSwitcher() {
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();

  function switchLocale(nextLocale) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => switchLocale(e.target.value)}
      disabled={isPending}
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeDisplayNames[locale] || locale}
        </option>
      ))}
    </select>
  );
}
```

### 8.2 Display Names

```js
// In i18n/routing.js
export const localeDisplayNames = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  // ...extensible
};
```

### 8.3 Placement

The `LocaleSwitcher` renders in:
- `<Navbar>` — shown on all public pages
- `<Footer>` — secondary placement

---

## 9. CMS Content Localization (v1)

### 9.1 Prisma Schema Change

Add `locale` field to the `Page` model:

```prisma
model Page {
  id          String        @id @default(cuid())
  title       String
  slug        String
  body        String        @db.Text
  content     Json?
  excerpt     String?
  layout      String        @default("standard")
  showHeader  Boolean       @default(false)
  status      ContentStatus @default(DRAFT)
  locale      String        @default("en")          // NEW
  publishedAt DateTime?
  authorId    String
  author      User          @relation(fields: [authorId], references: [id])
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([slug, locale])                          // CHANGED
  @@index([status])
  @@index([slug, locale])                           // CHANGED
  @@index([authorId])
  @@index([createdAt])
  @@index([locale])                                 // NEW
}
```

### 9.2 Content Query Changes

All public content queries must filter by locale:

```js
// Before:
findBySlug(prisma, model, slug) {
  return delegate.findFirst({ where: { slug, status: "PUBLISHED" } });
}

// After:
findBySlug(prisma, model, slug, locale) {
  return delegate.findFirst({ where: { slug, status: "PUBLISHED", locale } });
}
```

Files to update:
- `packages/cli/templates/cms/src/content-query.js` — `findBySlug()`, `findContent()`
- `packages/cli/templates/cms-public/lib/public-content.js` — all queries
- `apps/web/src/app/[locale]/[slug]/page.js` — locale-aware queries

### 9.3 Admin UI

The existing `ModelForm` already has `"locale"` in `CONFIG_NAME_HINTS`, which renders fields named `locale` as a `<select>` dropdown. This means:

- When a user creates a Page in the admin, they see a `locale` dropdown
- No admin form changes needed for the basic use case
- Migration: existing pages without `locale` get `locale: "en"` (the default)

### 9.4 Migration Strategy

```bash
# 1. Add locale column to Page
pnpm db:migrate --name add_locale_to_page

# 2. Backfill existing pages to default locale
# Run once:
UPDATE "Page" SET locale = 'en' WHERE locale IS NULL;
```

### 9.5 Future v2: Translation Tables

For projects needing richer content localization (separate slugs per locale, different content structures per locale), a `PageTranslation` model can be added:

```prisma
model PageTranslation {
  id        String   @id @default(cuid())
  pageId    String
  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  locale    String
  title     String
  body      String   @db.Text
  content   Json?
  excerpt   String?
  slug      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([pageId, locale])
  @@unique([slug, locale])
  @@index([locale])
}
```

v1 uses the simpler single-table approach. v2 is opt-in when the schema extension becomes a template option.

---

## 10. SEO

### 10.1 Metadata

`site-metadata.js` — locale-aware alternates:

```js
export function getSiteMetadata(locale = 'en') {
  const appUrl = getAppUrl();
  const { appName, appDescription } = config;
  const supported = getSupportedLocales();
  const languages = Object.fromEntries(
    supported.map((l) => [l, `${appUrl}/${l}`])
  );

  return {
    metadataBase: new URL(appUrl),
    title: { default: appName, template: `%s · ${appName}` },
    description: appDescription,
    alternates: {
      canonical: `/${locale}`,
      languages,
    },
    openGraph: {
      type: 'website',
      url: `${appUrl}/${locale}`,
      title: appName,
      description: appDescription,
      siteName: appName,
      locale, // OG locale
      localeAlternate: supported.filter((l) => l !== locale),
    },
    twitter: { card: 'summary', title: appName, description: appDescription },
    robots: getMetadataRobots(),
  };
}
```

### 10.2 Sitemap

`apps/web/src/app/sitemap.js` — per-locale entries with hreflang alternates:

```js
import { routing } from '@/i18n/routing';
import { getAppUrl } from '@techstream/quark-config';
import { getPublicContentSitemapEntries } from '@/lib/public-content';
import { isWebsiteIndexable } from '@/lib/seo/indexing';
import { buildSitemapEntries } from '@/lib/sitemap-entries';

export const revalidate = 3600;

export default async function sitemap() {
  if (!isWebsiteIndexable()) return [];

  const appUrl = getAppUrl();
  const entries = [];

  // Static routes per locale
  for (const locale of routing.locales) {
    const alternates = Object.fromEntries(
      routing.locales.map((l) => [l, `${appUrl}/${l}`])
    );

    entries.push({
      url: `${appUrl}/${locale}`,
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: { languages: alternates },
    });
  }

  // CMS pages per locale
  const publicContentEntries = await getPublicContentSitemapEntries();
  for (const { path, ...rest } of publicContentEntries) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${appUrl}/${locale}${path}`,
        ...rest,
      });
    }
  }

  return entries;
}
```

### 10.3 hreflang Link Headers

The `next-intl` middleware automatically injects `Link` response headers with hreflang alternates. No additional work needed beyond configuring the middleware.

### 10.4 Robots.txt

No changes needed. The existing `robots.js` already respects `ALLOW_INDEXING`.

---

## 11. Published Package Changes (`@techstream/quark-core`)

Add locale utility exports:

```js
// packages/core/src/locale.js (NEW)
const DEFAULT_LOCALE = 'en';

export function getDefaultLocale() {
  return process.env.DEFAULT_LOCALE || DEFAULT_LOCALE;
}

export function getSupportedLocales() {
  const raw = process.env.SUPPORTED_LOCALES || DEFAULT_LOCALE;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isLocaleSupported(locale) {
  return getSupportedLocales().includes(locale);
}
```

These provide a fallback when `next-intl` is not installed (projects without `--features i18n`).

---

## 12. Scaffolded Package: `packages/i18n/`

New optional workspace package created when `--features i18n` is selected:

```
packages/i18n/
├── package.json          # depends on next-intl
├── src/
│   ├── index.js          # re-exports
│   └── routing.js        # locale config, navigation helpers
├── README.md
└── .npmignore
```

`package.json`:
```json
{
  "name": "@app/i18n",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "next-intl": "^4.0.0"
  }
}
```

The `i18n/routing.js` in `apps/web/src/` re-exports from this package for app-level usage, or the package itself is imported directly.

---

## 13. CLI Scaffolding — Feature Integration

### 13.1 `FEATURE_META` Entry

```js
i18n: { requires: [], packages: ["i18n"], pairs: [] },
```

- No `requires` dependencies (standalone feature)
- Creates `packages/i18n/` from `templates/i18n/`
- Creates `messages/` from `templates/messages/`
- No `pairs` (all app changes are handled via file transforms, not template copies)

### 13.2 Template Directory Changes

| Template | Action | Description |
|---|---|---|
| `templates/i18n/` | **NEW** | Package files for i18n config |
| `templates/messages/` | **NEW** | Translation JSON files |
| `templates/base-project/apps/web/src/` | MODIFIED | Add `middleware.js` template |
| `templates/base-project/apps/web/src/app/layout.js` | MODIFIED | Conditionally includes i18n wrappers |
| `templates/base-project/apps/web/next.config.js` | MODIFIED | Conditionally wraps with `createNextIntlPlugin()` |
| `templates/cms-public/app/[slug]/` | MODIFIED | Moved under `[locale]/` when i18n enabled |
| `templates/ui/src/` | **NEW** | `locale-switcher.js` component |

### 13.3 Post-Scaffold Transforms (CLI)

When `i18n` is in the resolved feature set, the CLI performs these transforms after template copies:

1. **Create `middleware.js`** at `apps/web/src/middleware.js`
2. **Move `layout.js`** → `apps/web/src/app/[locale]/layout.js` with locale awareness
3. **Create thin root `layout.js`** at `apps/web/src/app/layout.js`
4. **Move `page.js`** → `apps/web/src/app/[locale]/page.js`
5. **Move `[slug]/page.js`** → `apps/web/src/app/[locale]/[slug]/page.js`
6. **Update `next.config.js`** — wrap with `createNextIntlPlugin()`
7. **Update `validate-env.js`** — add `DEFAULT_LOCALE`, `SUPPORTED_LOCALES`
8. **Update `sitemap.js`** — locale alternates
9. **Update `site-metadata.js`** — locale-aware metadata
10. **Update `package.json`** — add `next-intl` dependency
11. **Update `global-error.js`** — dynamic `lang`

**Marker system**: Use `// @quark:start:i18n` / `// @quark:end:i18n` markers in template files where code insertion is needed, similar to the existing job/admin markers.

### 13.4 `quark add i18n` Command

For existing projects, extend the `add` command to handle i18n:

1. Detect current file structure
2. Back up existing files before transformation
3. Create middleware, i18n config, messages directory
4. Restructure layouts (move under `[locale]`)
5. Update config and dependencies
6. Generate locale migration for existing CMS content

---

## 14. Implementation Phases

### Phase 1: Foundation (Week 1)

| Task | Files | Effort |
|---|---|---|
| Install `next-intl` in scaffolded web app | `packages/cli/templates/base-project/apps/web/package.json` | Small |
| Create `i18n/routing.js` | New file | Small |
| Create `i18n/request.js` | New file | Small |
| Create `messages/en.json` | New file | Small |
| Create middleware | `apps/web/src/middleware.js` | Medium |
| Wrap `next.config.js` with plugin | `next.config.js` | Small |
| Add locale env vars | `packages/config/src/validate-env.js` | Small |
| Restructure layouts | `layout.js` → `[locale]/layout.js`, new root `layout.js` | Medium |
| Update `global-error.js` | `global-error.js` | Small |
| **Status** | Stateless locales working, `/en/` routes functional | |

### Phase 2: Navigation & UI (Week 1-2)

| Task | Files | Effort |
|---|---|---|
| Create `LocaleSwitcher` component | `packages/ui/src/locale-switcher.js` | Medium |
| Update public page imports to `@/i18n/routing` | Home page, CMS pages | Medium |
| Update `site-metadata.js` | locale-aware alternates | Small |
| Update `sitemap.js` | locale-aware URLs | Medium |
| Update `robots.js` | verify no change needed | Small |
| **Status** | Navigation works, SEO good, switcher functional | |

### Phase 3: CMS Content Localization (Week 2)

| Task | Files | Effort |
|---|---|---|
| Add `locale` field to Page model | `schema.prisma` | Small |
| Create migration | `pnpm db:migrate` | Small |
| Update content queries | `content-query.js`, `public-content.js` | Medium |
| Update public page rendering | `[locale]/[slug]/page.js` | Small |
| Verify admin form handles locale | `ModelForm.js` | Small (already works) |
| Test CMS content per locale | E2E | Medium |
| **Status** | Content is locale-aware, admin works | |

### Phase 4: CLI & Templates (Week 2-3)

| Task | Files | Effort |
|---|---|---|
| Create `FEATURE_META` entry for i18n | `packages/cli/src/index.js` | Small |
| Create `templates/i18n/` package | New directory | Small |
| Create `templates/messages/` | New directory | Small |
| Create post-scaffold transforms | CLI transform logic | Large |
| Create `templates/ui/src/locale-switcher.js` | New file | Small |
| Update base-project templates with markers | All modified templates | Medium |
| Implement `quark add i18n` | CLI add command | Large |
| Sync templates | `pnpm sync-templates` | Small |
| **Status** | CLI ready, `quark create --features i18n` works | |

### Phase 5: Polish & Edge Cases (Week 3)

| Task | Effort |
|---|---|
| Test with RTL locales (ar, he) | Medium |
| Test fallback chains (`es-MX` → `es` → `en`) | Medium |
| Test static generation (`generateStaticParams`) | Small |
| Test ISR revalidation per locale | Medium |
| Test `quark add i18n` on existing project | Large |
| Test with `--features i18n,cms` combined | Medium |
| Test with `--features i18n` alone (no CMS) | Medium |
| Document i18n in CLAUDE.md | Small |
| **Status** | Production-ready | |

---

## 15. Open Questions & Decisions

### 15.1 Resolved

| Question | Decision |
|---|---|
| Which library? | `next-intl` |
| Routing strategy? | Prefix-based (`/en/...`), localePrefix: `always` |
| Admin under `[locale]`? | No — stays at root |
| CMS content localization? | Single-table `locale` field (v1) |
| Feature type? | Optional, standalone (`requires: []`) |
| RTL support? | v1: detect via locale, set `dir` attribute. Full RTL CSS audit deferred. |

### 15.2 Needs Discussion

| Question | Options | Recommendation |
|---|---|---|
| Auto-include i18n with CMS? | (a) `cms` requires `i18n` (b) Recommended but not required (c) Independent | **(b)** — CMS without i18n is valid (single-language content). Flag a suggestion during scaffolding. |
| Where does the `i18n` config live? | (a) `packages/i18n/` workspace package (b) `apps/web/src/i18n/` directory (c) Both | **(c)** — Workspace package for shared locale config + app-specific routing wrappers in `apps/web/src/i18n/` |
| `localePrefix: 'as-needed'` support? | v1 vs v2 | **v1: `'always'`** — simpler, better SEO. `'as-needed'` added later. |
| Message file location? | (a) `messages/` at root (b) `apps/web/messages/` (c) `packages/i18n/messages/` | **(a)** — Standard next-intl convention, cleanest path for `import()`. |
| Should translation strings be extracted from existing Quark UI? | (a) Yes, all UI strings externalized (b) Only public-facing strings (c) None, defer to user | **(c)** — Quark scaffolds the *framework* for i18n. The starter translations are examples. Projects own their translation content. |
| Type-safe keys in v1? | (a) Full TS declaration (b) None, documentation only | **(b)** — Quark doesn't use TypeScript. Key conventions are documented. |
| `next-intl` version pinning? | Pin to major version | Pin `^4.0.0` in CLI templates |

### 15.3 Risks

| Risk | Mitigation |
|---|---|
| Layout restructuring (moving files under `[locale]`) could break existing projects during `quark add i18n` | Backup before transform; detailed migration guide; test coverage |
| Admin links to public pages need locale context when admin is outside `[locale]` | Pass locale via query param or infer from default locale |
| CMS content duplicate slugs across locales | `@@unique([slug, locale])` constraint prevents conflicts |
| Performance: `setRequestLocale` must be called in every page/layout | Document as mandatory pattern; add lint rule or test |
| `next-intl` updates could break the scaffolding | Pin major version; Dependabot for patch/minor updates |
