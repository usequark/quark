---
name: i18n
description: Add internationalization and localization to Quark apps. Use when adding multi-language support, locale routing, hreflang SEO, locale-aware sitemaps, or localized CMS content.
---

# i18n Skill

Add multi-language support to a Quark app using `next-intl` with prefix-based routing (`/en/...`), locale detection, and localized CMS content queries. This skill gives you the domain context, Quark framework patterns, and end-result shape. You generate the code that fits the user's exact requirements.

## Context

A localized app must handle locale detection, routing, content translation, and SEO. The core concerns:

- **Locale detection** — resolve the active locale from URL prefix, cookie, `Accept-Language` header, then fallback to default.
- **Routing** — prefix-based (`/en/about`, `/es/acerca-de`) for SEO and shareable URLs.
- **Content localization** — locale field on CMS models, queries filtered by locale, fallback chains.
- **SEO** — `hreflang` alternates, locale-aware sitemaps, `lang` attribute on `<html>`.
- **UI** — locale switcher component, localized formatting (dates, numbers).

## Locale detection chain

```
1. URL path prefix      (/en/...)    → explicit user choice
2. Cookie (n-lang)      ← set by LocaleSwitcher component
3. Accept-Language      ← browser default
4. defaultLocale        ← configured fallback ("en")
```

## Framework context (build on Quark)

- **Library:** `next-intl` — purpose-built for Next.js App Router, native Server Component support, middleware-based locale negotiation, ~2 KB bundle.
- **Routing:** prefix-based with `localePrefix: 'always'`. All public URLs include the locale prefix. Admin (`/admin`), auth (`/auth`), and API (`/api`) routes stay outside `[locale]`.
- **Middleware:** `next-intl/middleware` handles locale detection, redirects, and 404s. Configure in `src/i18n/middleware.js`.
- **Request config:** `getRequestConfig` from `next-intl/server` resolves the locale per request and loads message files.
- **Models:** CMS models get a `locale String` field. Queries filter by locale with fallback chain.
- **Validation** — Zod for all Server Actions and API routes. Use a locale enum for localized content submissions.
- **Auth** via `getCurrentSession` from `@usequark/quark-core`.
- **Locale utilities** from `@usequark/quark-core/locale`: `getDefaultLocale()`, `getSupportedLocales()`, `isLocaleSupported()`.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Install `next-intl` and configure `getRequestConfig`, middleware, and routing.
3. Create message files per locale under `messages/` (e.g., `messages/en.json`, `messages/es.json`).
4. Wrap the app root with `NextIntlClientProvider`; set `html lang` attribute.
5. Add a locale switcher component (client-side, updates cookie + router).
6. Add CMS localization: locale field on models, query helpers filtered by locale.
7. Add SEO: `hreflang` alternates, locale-aware sitemap, metadata per locale.

## Example: routing config

```js
// src/i18n/routing.js
import { defineRouting } from "next-intl/routing";
import { getDefaultLocale, getSupportedLocales } from "@usequark/quark-core/locale";

const supportedLocales = getSupportedLocales();

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale: getDefaultLocale(),
  localePrefix: "always",
});
```

## Example: request config

```js
// src/i18n/request.js
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing.js";

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

## Example: middleware setup

```js
// src/i18n/middleware.js
import createMiddleware from "next-intl/middleware";
import { routing } from "./routing.js";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|admin|auth|_next|.*\\..*).*)"],
};
```

## Example: locale switcher component

```jsx
"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { getSupportedLocales } from "@usequark/quark-core/locale";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("LocaleSwitcher");
  const locales = getSupportedLocales();

  function onSelect(next) {
    const path = pathname.replace(`/${locale}`, `/${next}`);
    document.cookie = `n-lang=${next};path=/;max-age=31536000`;
    router.push(path);
  }

  return (
    <select aria-label={t("label")} value={locale} onChange={(e) => onSelect(e.target.value)}>
      {locales.map((l) => (
        <option key={l} value={l}>{l.toUpperCase()}</option>
      ))}
    </select>
  );
}
```

## Example: CMS model with locale

```prisma
model Page {
  id          String        @id @default(cuid())
  title       String
  slug        String
  body        String        @db.Text
  locale      String        @default("en")
  status      ContentStatus @default(DRAFT)
  authorId    String
  author      User          @relation(fields: [authorId], references: [id])
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([slug, locale])
  @@index([locale])
}
```

## Example: locale-aware query

```js
import { getDefaultLocale, isLocaleSupported } from "@usequark/quark-core/locale";

export async function getPageBySlug(slug, locale) {
  const validLocale = isLocaleSupported(locale) ? locale : getDefaultLocale();
  return prisma.page.findFirst({
    where: { slug, locale: validLocale, status: "PUBLISHED" },
  });
}
```

## SEO: hreflang and sitemap

```jsx
// In your page component's generateMetadata:
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  return {
    alternates: {
      languages: Object.fromEntries(
        getSupportedLocales().map((l) => [l, `${baseUrl}/${l}/${slug}`])
      ),
    },
    lang: locale,
  };
}
```

## Example: Zod validation for localized content

```js
import { z } from "zod";
import { isLocaleSupported } from "@usequark/quark-core/locale";

export const localizedPageSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  body: z.string().min(1),
  locale: z.string().refine(isLocaleSupported, "Unsupported locale"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});
```

## Workflow summary

1. Install `next-intl`, configure routing + middleware + request config.
2. Create `messages/{locale}.json` with translation keys.
3. Wrap root layout with `NextIntlClientProvider`, set `html lang`.
4. Build a `LocaleSwitcher` client component.
5. Add `locale` field to CMS models, update queries with fallback.
6. Add `hreflang` alternates and locale-aware sitemap.
7. Test detection chain: URL → cookie → Accept-Language → default.

## End result

A localized Quark app where users switch languages via a prefix-based URL scheme, locale is detected from URL → cookie → header → default, CMS content is filtered by locale with fallback, SEO metadata includes `hreflang` alternates and locale-aware sitemaps, and all content submissions validate locale against the configured supported set — following Quark conventions throughout.
