# @yourscope/ui

Scaffolded UI primitives for your Quark project. These components are **yours** - modify, extend, or replace them freely.

> This package is scaffolded via `quark-create-app`. There is no version sync back to Quark after scaffolding.

## Import

```javascript
import { Button, Card, Badge } from '@yourscope/ui';
```

## Components

### Button
Props: `variant` ('primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'info' | 'outline' | 'solid', default: 'primary'), `size` ('sm' | 'md' | 'lg', default: 'md'), `icon` (React element or string rendered inline alongside children), `href` (renders as Next.js Link), `className`, all native button attributes.

### Input
Props: `className`, all native input attributes.

### Label
Props: `className`, all native label attributes.

### Textarea
Props: `className`, all native textarea attributes.

### Select
Props: `className`, `children` (option elements), `value`/`defaultValue`, `onChange`, `name`, `required`, `disabled`, plus trigger button attributes.

### Checkbox
Props: `id`, `label` (string), `className`, all native checkbox input attributes.

### Badge
Props: `variant` ('default' | 'primary' | 'success' | 'warning' | 'danger' | 'info', default: 'default'), `className`.

### Card / CardHeader / CardTitle / CardContent / CardFooter
Composable card container. All parts accept `className`.

### Container
Minimal wrapper that provides the outer shell styling (rounded, border, surface background). Accepts `className` and `children`.

### Lightbox
`"use client"` - Overlay image viewer with optional previous/next navigation and keyboard support.
Props: `src` (string), `alt`, `caption`, `open` (bool), `onClose` (fn), `onPrevious` (fn), `onNext` (fn), `showPrevious` (bool), `showNext` (bool), `currentIndex` (number), `totalCount` (number), `className`.

### FormField
`"use client"` - Composible field wrapper for label + input + error display.
Props: `label` (string), `name` (string), `error` (string, optional), `children` (custom input, optional - defaults to `<Input>`), `className`, all native input attributes when no children.

### Table / TableHeader / TableBody / TableRow / TableHead / TableCell
Composable table. `Table` wraps in a scrollable container. All parts accept `className`.

### Skeleton
Props: `className` (use to set width/height for the placeholder shape).

### ErrorBanner
Props: `message`, `className`. Returns `null` when `message` is empty.

### RichText
`"use client"` - dependency-free rich text editor built on `contentEditable`.
Props: `id`, `name`, `defaultValue`, `placeholder`, `disabled`, `required`, `rows`, `className`, `onChange`.

### Dialog
`"use client"` - Props: `open` (bool), `onClose` (fn), `title` (string), `children`, `className`.

### Toast / useToast
`"use client"` - `Toast` props: `message`, `variant` ('default' | 'success' | 'error'), `onClose` (fn), `visible` (bool).  
`useToast()` returns `{ show(message, variant?), hide, toastProps }`. Spread `toastProps` onto `<Toast />`.

### Footer
Standardized multi-column site footer with brand block, CTA, links, and legal bottom bar.
Props include: `brandName`, `brandDescription`, `ctaLabel`, `ctaHref`, `columns` (3-column array), `copyrightText`, `legalLinks`, `poweredByText`, `poweredByHref`, `mark`, `className`.

### Navbar
`"use client"` desktop navigation bar with three-zone layout: logo (left), centered nav links (middle), and action button (right). Supports dropdown sub-navigation on parent items.
Props include: `logo`, `logoHref`, `links`, `action`, `maxWidthClassName`, `className`.

### MobileNavbar
`"use client"` mobile-first navigation with logo + burger trigger, animated menu expansion, and animated nested submenus.
Props include: `logo`, `logoHref`, `links`, `action`, `maxWidthClassName`, `className`.

```javascript
// Example
const { show, toastProps } = useToast();
return (
  <>
    <Button onClick={() => show('Saved!', 'success')}>Save</Button>
    <Toast {...toastProps} />
  </>
);
```

## Design notes
- Tailwind CSS only. No CSS-in-JS, no external dependencies.
- All components accept `className` for overrides.
- Client-only components: `Dialog`, `Toast`, `useToast`, `Select`, `Lightbox`, `FormField`, `RichText`, `Navbar`, `MobileNavbar`, `ThemeProvider`, `useTheme`.
- Accessible: ARIA attributes, focus management on interactive elements.

## Example references
- Public-page example: `apps/web/src/app/page.js`
- Component props and usage: the tables in this file

---

## Theming Guide

All visual styling in this package is driven by **CSS custom properties** (variables). Components reference `var(--btn-bg)`, `var(--card-radius)`, `var(--navbar-bg)`, etc. — no hardcoded values. This means you can completely retheme the UI without touching any component source files.

### 1. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  globals.css                                                 │
│                                                              │
│  @import "@usequark/quark-ui/themes/brutalist-yellow.css"  │
│                                                              │
│  :root {                                                     │
│    --color-primary: #377dff;                                 │
│    --btn-radius: var(--radius-default);                      │
│    --card-shadow: 0 1px 3px rgba(0,0,0,0.1);                │
│    ...                                                       │
│  }                                                           │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│  @usequark/quark-ui components                             │
│                                                              │
│  <button class="bg-[--btn-bg] border-[--btn-border]          │
│                text-[--btn-text] rounded-[--btn-radius] ...">│
│    Click me                                                  │
│  </button>                                                   │
└──────────────────────────────────────────────────────────────┘
```

**How it works:**

1. **Base colour tokens** (`--color-primary`, `--color-bg`, `--color-text`, etc.) define the core palette.
2. **Component-level tokens** (`--btn-bg`, `--card-radius`, `--navbar-bg`, etc.) reference the base tokens or set specific values.
3. **Theme CSS files** in `packages/ui/themes/` override every variable to produce a coherent design direction.
4. **Import a theme** in your `globals.css` and all components update automatically.
5. **Scoped overrides** let you change variables within a specific section or page.

### 2. Quick Start

Import a theme in your app's `globals.css`:

```css
/* apps/web/src/app/globals.css */

@import "tailwindcss";
@source "../../../../packages/ui/src/**/*.{js,jsx}";

/* Load a preset theme */
@import "@usequark/quark-ui/themes/editorial-coral.css";

@custom-variant dark (&:is([data-theme="dark"] *));

:root {
  /* Your app-specific overrides go here */
  --quark-page-bg: var(--color-bg);
}
```

Themes are importable via the package export pattern:
```css
@import "@usequark/quark-ui/themes/brutalist-yellow.css";
@import "@usequark/quark-ui/themes/red-noir.css";
@import "@usequark/quark-ui/themes/swiss-minimalist.css";
```

In a monorepo context you can also use a relative path:
```css
@import "../../../../packages/ui/themes/editorial-coral.css";
```

### 3. Available Themes

The package ships with 8 curated themes in `packages/ui/themes/`:

| Theme | File | Description |
|---|---|---|
| **Brutalist Yellow** | `brutalist-yellow.css` | High-contrast editorial with golden yellow, charcoal surfaces, and sharp geometry. Anton + Satoshi. |
| **Red Noir** | `red-noir.css` | Dark cinematic with blood-red accents, black backgrounds, pill-shaped buttons, and glow effects. Manrope. |
| **Editorial Coral** | `editorial-coral.css` | Warm coral and ink-blue editorial with glassmorphism nav, soft rounded corners, and ambient blur. Instrument Serif + Manrope. |
| **Soft Wellness** | `soft-wellness.css` | Gentle peach/coral pastels with pillowy rounded corners, grain texture, and floating animations. Outfit + Reenie Beanie. |
| **Playful Geometric** | `playful-geometric.css` | Violet, pink, and amber Memphis-inspired with chunky 2px borders, hard offset shadows, and warm cream base. Outfit + Plus Jakarta Sans. |
| **Hyper Saturated** | `hyper-saturated.css` | Cyber yellow on deep onyx with glassmorphism, frosted glass overlays, and liquid section dividers. Inter. |
| **Season 04** | `season-04.css` | High-fashion brutalist with beige/burnt red palette, SVG noise texture, and neon green micro-interactions. Clash Grotesk. |
| **Swiss Minimalist** | `swiss-minimalist.css` | Typography-first Swiss editorial with off-white background, deep black text, grayscale palette, and echo text layering. Clash Display + Satoshi. |

### 4. Custom Themes

Create a custom theme by overriding CSS variables in your `globals.css`:

```css
/* apps/web/src/app/globals.css */

:root {
  /* Base palette */
  --color-primary: #7c3aed;
  --color-primary-hover: #8b5cf6;
  --color-primary-muted: rgba(124, 58, 237, 0.1);

  --color-bg: #faf5ff;
  --color-surface: #ffffff;
  --color-surface-hover: #f5f0ff;

  --color-border: #e4d5f5;
  --color-border-hover: #d4bff0;

  --color-text: #1e1b2e;
  --color-text-muted: #6d5a8a;
  --color-text-faint: #9d8ab5;

  --radius-default: 8px;

  /* Component overrides */
  --btn-radius: 8px;
  --btn-font-weight: 600;
  --btn-primary-bg: var(--color-primary);
  --btn-primary-border: var(--color-primary);
  --btn-primary-text: #ffffff;
  --btn-shadow: 0 4px 6px rgba(124, 58, 237, 0.2);

  --card-radius: 12px;
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  --nav-radius: 12px;
  --nav-blur: 8px;
  --nav-bg: rgba(255, 255, 255, 0.8);

  --input-radius: 8px;
  --input-focus-ring: rgba(124, 58, 237, 0.2);

  --badge-radius: 999px;
  --dialog-radius: 16px;
  --toast-radius: 12px;
  --table-radius: 8px;
}
```

You can also override variables scoped to a specific section:

```css
.promo-section {
  --btn-primary-bg: #f59e0b;
  --btn-primary-border: #f59e0b;
  --btn-primary-text: #1a1a2e;
  --btn-radius: 999px;
  --card-shadow: 0 8px 24px rgba(245, 158, 11, 0.2);
}
```

```jsx
<section className="promo-section">
  <Button variant="primary">Get Started</Button>
  <Card>...</Card>
</section>
```

To save a custom theme as a reusable file, create a new `.css` file in `packages/ui/themes/` and add the export pattern to `package.json`:
```json
{
  "exports": {
    ".": "./src/index.js",
    "./themes/*": "./themes/*.css"
  }
}
```

### 5. Per-Component Variables

Every component reads its visual properties from CSS variables. Below is the complete reference organized by component.

#### Base Colour Tokens

Set these first — component variables reference them by default.

```css
--color-primary: #377dff;
--color-primary-hover: #5594ff;
--color-primary-muted: rgba(55, 125, 255, 0.1);

--color-bg: #09101a;
--color-surface: #101827;
--color-surface-hover: #1c2642;

--color-border: #263044;
--color-border-hover: rgba(55, 125, 255, 0.4);

--color-text: #e8eaf0;
--color-text-muted: #8d9ec0;
--color-text-faint: #7886a8;

--color-danger: #ff4757;
--color-danger-hover: #ff6b78;
--color-danger-muted: rgba(255, 71, 87, 0.1);

--color-success: #34d399;
--color-success-muted: rgba(52, 211, 153, 0.1);

--color-warning: #fbbf24;
--color-warning-muted: rgba(251, 191, 36, 0.1);

--color-info: #22d3ee;
--color-info-muted: rgba(34, 211, 238, 0.1);

--radius-default: 0px;
```

#### Button

| Variable | Default | Controls |
|---|---|---|
| `--btn-radius` | `var(--radius-default)` | Border radius |
| `--btn-bg` | `var(--color-primary-hover)` | Background colour |
| `--btn-border` | `var(--color-primary-hover)` | Border colour |
| `--btn-text` | `#ffffff` | Text colour |
| `--btn-ring` | `color-mix(...)` | Focus ring colour |
| `--btn-hover-brightness` | `0.95` | Hover brightness filter |
| `--btn-hover-shadow` | `0 4px 6px ...` | Hover box-shadow |
| `--btn-hover-bg` | `transparent` | Hover background |
| `--btn-hover-text` | `inherit` | Hover text colour |
| `--btn-hover-opacity` | `1` | Hover opacity |

#### Badge

| Variable | Default | Controls |
|---|---|---|
| `--badge-bg` | `var(--color-surface-hover)` | Background colour |
| `--badge-border` | `var(--color-border)` | Border colour |
| `--badge-text` | `var(--color-text-muted)` | Text colour |

#### Card

| Variable | Default | Controls |
|---|---|---|
| `--card-bg` | `var(--color-surface)` | Background colour |
| `--card-border` | `var(--color-border)` | Border colour |
| `--card-title-text` | `var(--color-text)` | Title text colour |
| `--card-text-muted` | `var(--color-text-muted)` | Muted text colour |
| `--card-trigger-hover-bg` | `var(--color-surface-hover)` | Collapsible trigger hover bg |
| `--card-trigger-ring` | `color-mix(...)` | Trigger focus ring |

#### Navbar

| Variable | Default | Controls |
|---|---|---|
| `--navbar-bg` | `color-mix(...)` | Navbar background |
| `--navbar-mobile-bg` | `var(--color-surface)` | Mobile menu background |
| `--navbar-border` | `var(--color-border)` | Border colour |
| `--navbar-inset-shadow` | `inset 0 1px 0 ...` | Inner top border highlight |
| `--navbar-text` | `var(--color-text)` | Text colour |
| `--navbar-text-muted` | `var(--color-text-muted)` | Muted link colour |
| `--navbar-hover-bg` | `var(--color-surface)` | Link hover background |
| `--navbar-hover-text` | `var(--color-text)` | Link hover text colour |
| `--navbar-logo-text` | `var(--color-text)` | Logo text colour |
| `--navbar-logo-hover` | `var(--color-primary)` | Logo hover colour |
| `--navbar-mark-bg` | `var(--color-primary-muted)` | Logo mark background |
| `--navbar-mark-border` | `color-mix(...)` | Logo mark border |
| `--navbar-mark-text` | `var(--color-primary)` | Logo mark text |
| `--navbar-action-border` | `color-mix(...)` | CTA button border |
| `--navbar-action-bg` | `var(--color-primary-muted)` | CTA button background |
| `--navbar-action-text` | `var(--color-primary)` | CTA button text |
| `--navbar-action-hover-border` | `var(--color-primary)` | CTA button hover border |
| `--navbar-action-hover-bg` | `color-mix(...)` | CTA button hover bg |
| `--navbar-ring` | `color-mix(...)` | Focus ring colour |
| `--navbar-dropdown-bg` | `var(--color-surface)` | Dropdown background |
| `--navbar-dropdown-border` | `var(--color-border)` | Dropdown border |
| `--navbar-dropdown-shadow` | `0 20px 25px ...` | Dropdown shadow |
| `--navbar-mobile-panel-bg` | `var(--color-surface)` | Mobile panel background |
| `--navbar-mobile-panel-border` | `var(--color-border)` | Mobile panel border |
| `--navbar-divide-border` | `var(--color-border)` | Divider border colour |

#### Footer

| Variable | Default | Controls |
|---|---|---|
| `--footer-bg` | `var(--color-surface)` | Background colour |
| `--footer-border` | `var(--color-border)` | Border colour |
| `--footer-text` | `var(--color-text)` | Text colour |
| `--footer-text-muted` | `var(--color-text-muted)` | Muted text colour |
| `--footer-text-faint` | `var(--color-text-faint)` | Faint text colour |
| `--footer-mark-bg` | `var(--color-primary-muted)` | Logo mark background |
| `--footer-mark-text` | `var(--color-primary)` | Logo mark text |
| `--footer-cta-border` | `var(--color-primary)` | CTA link border |
| `--footer-cta-text` | `var(--color-primary)` | CTA link text |
| `--footer-cta-hover-bg` | `var(--color-primary-muted)` | CTA link hover bg |
| `--footer-link-hover` | `var(--color-text)` | Link hover colour |
| `--footer-sep` | `color-mix(...)` | Separator colour |

#### Input / Textarea / Select

| Variable | Default | Controls |
|---|---|---|
| `--input-bg` | `var(--color-surface-hover)` | Background colour |
| `--input-border` | `var(--color-border)` | Border colour |
| `--input-text` | `var(--color-text)` | Text colour |
| `--input-placeholder` | `var(--color-text-faint)` | Placeholder colour |
| `--input-border-hover` | `var(--color-border-hover)` | Hover border colour |
| `--input-border-focus` | `var(--color-primary)` | Focus border colour |
| `--input-ring-focus` | `color-mix(...)` | Focus ring colour |
| `--input-disabled-opacity` | `0.3` | Disabled opacity |
| `--input-icon` | `var(--color-text-muted)` | Icon colour |
| `--input-icon-hover` | `var(--color-text)` | Icon hover colour |
| `--select-bg` | `var(--color-surface-hover)` | Select background |
| `--select-border` | `var(--color-border)` | Select border |
| `--select-text` | `var(--color-text)` | Select text |
| `--select-text-faint` | `var(--color-text-faint)` | Select placeholder |
| `--select-border-hover` | `var(--color-border-hover)` | Select hover border |
| `--select-ring` | `color-mix(...)` | Select focus ring |
| `--select-panel-bg` | `var(--color-surface)` | Dropdown panel bg |
| `--select-panel-border` | `var(--color-border)` | Dropdown panel border |
| `--select-option-hover-bg` | `var(--color-surface-hover)` | Option hover bg |
| `--select-option-hover-text` | `var(--color-text)` | Option hover text |
| `--select-option-active-bg` | `var(--color-primary-muted)` | Selected option bg |
| `--select-option-active-text` | `var(--color-primary)` | Selected option text |

#### Dialog

| Variable | Default | Controls |
|---|---|---|
| `--dialog-bg` | `var(--color-surface)` | Background colour |
| `--dialog-border` | `var(--color-border)` | Border colour |
| `--dialog-title-text` | `var(--color-text)` | Title text colour |
| `--dialog-text-muted` | `var(--color-text-muted)` | Muted text colour |
| `--dialog-close-hover-bg` | `var(--color-surface-hover)` | Close button hover bg |
| `--dialog-close-ring` | `var(--color-border-hover)` | Close button focus ring |
| `--dialog-backdrop` | `rgba(0, 0, 0, 0.6)` | Overlay background |

#### Toast

| Variable | Default | Controls |
|---|---|---|
| `--toast-bg` | `var(--color-primary-muted)` | Background colour |
| `--toast-border` | `color-mix(...)` | Border colour |
| `--toast-text` | `var(--color-primary)` | Text colour |
| `--toast-shadow` | `0 20px 25px ...` | Box shadow |

#### Table

| Variable | Default | Controls |
|---|---|---|
| `--table-bg` | `var(--color-surface)` | Background colour |
| `--table-border` | `var(--color-border)` | Border colour |
| `--table-header-bg` | `var(--color-surface-hover)` | Header background |
| `--table-row-hover-bg` | `color-mix(...)` | Row hover background |
| `--table-row-active-bg` | `color-mix(...)` | Active row background |
| `--table-head-text` | `var(--color-text-faint)` | Header text colour |
| `--table-cell-text` | `var(--color-text)` | Cell text colour |
| `--table-sort-icon` | `var(--color-text-faint)` | Sort icon colour |
| `--table-sort-icon-hover` | `var(--color-text)` | Sort icon hover colour |
| `--table-sort-active` | `var(--color-primary)` | Active sort colour |
| `--table-ring` | `color-mix(...)` | Focus ring colour |

#### Skeleton

| Variable | Default | Controls |
|---|---|---|
| `--skeleton-bg` | `rgba(30, 37, 53, 0.7)` | Placeholder background |

#### Container

| Variable | Default | Controls |
|---|---|---|
| `--container-bg` | `var(--color-surface)` | Background colour |
| `--container-border` | `var(--color-border)` | Border colour |

#### Error Banner

| Variable | Default | Controls |
|---|---|---|
| `--error-bg` | `var(--color-danger-muted)` | Background colour |
| `--error-border` | `color-mix(...)` | Border colour |
| `--error-text` | `var(--color-danger)` | Text colour |

#### Checkbox

| Variable | Default | Controls |
|---|---|---|
| `--checkbox-bg` | `#090d14` | Background colour |
| `--checkbox-border` | `#1e2535` | Border colour |
| `--checkbox-accent` | `#377dff` | Checked accent colour |
| `--checkbox-ring` | `color-mix(...)` | Focus ring colour |
| `--checkbox-disabled-opacity` | `0.4` | Disabled opacity |
| `--checkbox-label-text` | `#6b7a99` | Label text colour |

#### Label

| Variable | Default | Controls |
|---|---|---|
| `--label-text` | `var(--color-text-muted)` | Text colour |

#### Logo

| Variable | Default | Controls |
|---|---|---|
| `--logo-blue-arc` | `#377dff` | Blue arc colour |
| `--logo-red-arc` | `#ff4757` | Red arc colour |
| `--logo-red-dash` | `#ff4757` | Red dash colour |

#### Lightbox

| Variable | Default | Controls |
|---|---|---|
| `--lightbox-backdrop` | `rgba(0, 0, 0, 0.8)` | Overlay background |
| `--lightbox-btn-border` | `rgba(255, 255, 255, 0.25)` | Nav button border |
| `--lightbox-btn-text` | `#ffffff` | Nav button text |
| `--lightbox-btn-hover-bg` | `rgba(255, 255, 255, 0.15)` | Nav button hover bg |
| `--lightbox-btn-ring` | `rgba(255, 255, 255, 0.6)` | Nav button focus ring |
| `--lightbox-caption-text` | `rgba(255, 255, 255, 0.85)` | Caption text colour |
| `--lightbox-counter-text` | `rgba(255, 255, 255, 0.8)` | Counter text colour |

#### Rich Text

| Variable | Default | Controls |
|---|---|---|
| `--richtext-bg` | `var(--color-surface-hover)` | Editor background |
| `--richtext-border` | `var(--color-border)` | Border colour |
| `--richtext-text` | `var(--color-text)` | Text colour |
| `--richtext-border-focus` | `var(--color-primary)` | Focus border colour |
| `--richtext-ring` | `color-mix(...)` | Focus ring colour |
| `--richtext-toolbar-bg` | `var(--color-surface)` | Toolbar background |
| `--richtext-toolbar-border` | `var(--color-border)` | Toolbar border |
| `--richtext-btn-text` | `var(--color-text-muted)` | Toolbar button text |
| `--richtext-btn-hover-bg` | `var(--color-surface-hover)` | Toolbar button hover bg |
| `--richtext-btn-hover-text` | `var(--color-text)` | Toolbar button hover text |
| `--richtext-btn-active-bg` | `var(--color-surface-hover)` | Active button bg |
| `--richtext-btn-active-text` | `var(--color-text)` | Active button text |
| `--richtext-separator` | `var(--color-border)` | Toolbar separator |
| `--richtext-placeholder` | `var(--color-text-faint)` | Placeholder colour |
| `--richtext-link` | `var(--color-primary)` | Link colour |
| `--richtext-blockquote-border` | `var(--color-border)` | Blockquote border |
| `--richtext-blockquote-text` | `var(--color-text-muted)` | Blockquote text |
| `--richtext-code-bg` | `var(--color-surface-hover)` | Code background |

#### Theme Toggle

| Variable | Default | Controls |
|---|---|---|
| `--toggle-track-bg` | `#e5e7eb` / `#131d30` | Toggle track background |
| `--toggle-track-border` | `#d1d5db` / `#253650` | Toggle track border |
| `--toggle-knob-bg` | `#9ca3af` / `#377dff` | Toggle knob colour |
| `--toggle-knob-x` | `translateX(0)` / `translateX(14px)` | Knob position |

### 6. Variant System

Button, Badge, and Toast use `data-*` attributes to switch between visual variants. The component renders a `data-btn-variant`, `data-badge-variant`, or `data-toast-variant` attribute, and CSS attribute selectors override the relevant CSS variables.

#### Button Variants

The `Button` component accepts `variant` prop: `'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'info' | 'outline' | 'solid'`.

Each variant is defined via `[data-btn-variant="..."]` selectors that override `--btn-bg`, `--btn-border`, `--btn-text`, `--btn-ring`, and hover variables:

```css
[data-btn-variant="primary"] {
  --btn-bg: var(--color-primary-hover);
  --btn-border: var(--color-primary-hover);
  --btn-text: #ffffff;
  --btn-hover-brightness: 0.95;
  --btn-hover-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --btn-ring: color-mix(in srgb, var(--color-primary) 60%, transparent);
}
[data-btn-variant="ghost"] {
  --btn-bg: transparent;
  --btn-border: transparent;
  --btn-text: var(--color-text-faint);
  --btn-hover-bg: var(--color-surface-hover);
  --btn-hover-text: var(--color-text);
}
```

Theme files can override variant-specific variables too. For example, Red Noir gives the primary button a conic gradient border:

```css
[data-btn-variant="primary"] {
  --btn-bg: var(--color-primary);
  --btn-border: transparent;
  background-image: conic-gradient(from 0deg, #ef233c, #ff4d5e, #ef233c, #ff4d5e, #ef233c);
}
```

#### Badge Variants

The `Badge` component accepts `variant` prop: `'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'`.

```css
[data-badge-variant="default"] {
  --badge-bg: var(--color-surface-hover);
  --badge-border: var(--color-border);
  --badge-text: var(--color-text-muted);
}
[data-badge-variant="primary"] {
  --badge-bg: var(--color-primary-muted);
  --badge-border: color-mix(in srgb, var(--color-primary) 40%, transparent);
  --badge-text: var(--color-primary);
}
```

#### Toast Variants

The `Toast` component accepts `variant` prop: `'default' | 'success' | 'error'`.

```css
[data-toast-variant="default"] {
  --toast-bg: var(--color-primary-muted);
  --toast-border: color-mix(in srgb, var(--color-primary) 40%, transparent);
  --toast-text: var(--color-primary);
}
[data-toast-variant="success"] {
  --toast-bg: var(--color-success-muted);
  --toast-border: color-mix(in srgb, var(--color-success) 40%, transparent);
  --toast-text: var(--color-success);
}
[data-toast-variant="error"] {
  --toast-bg: var(--color-danger-muted);
  --toast-border: color-mix(in srgb, var(--color-danger) 40%, transparent);
  --toast-text: var(--color-danger);
}
```

### 7. AI Agent Integration

A dedicated design system skill is available at `~/.config/opencode/skills/design-system/SKILL.md` for AI-assisted theming. Load it when building user-facing UI:

```
skill("design-system")
```

The skill provides:
- The complete CSS variable reference (all components)
- A prompt library with 8 curated design directions (full `:root` blocks)
- A theme creation guide for building custom themes from design briefs
- Usage examples for import, override, and scoped styling
- Anti-latching warning: the default raw styling is a blank canvas — always pick a theme or create one

### 8. Dark / Light Mode

Themes handle light and dark variants using two strategies:

#### a. `prefers-color-scheme` media query (automatic)

Themes include a `@media (prefers-color-scheme: light)` block that activates when the OS is in light mode and the user hasn't explicitly pinned dark:

```css
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --color-bg: #f5f2eb;
    --color-surface: #ffffff;
    --color-text: #171e19;
    /* ... all light-mode variable overrides ... */
  }
}
```

#### b. Explicit `[data-theme]` attribute (manual toggle)

Themes also include explicit `:root[data-theme="light"]` and `:root[data-theme="dark"]` blocks that override the media query when the user has toggled the theme manually:

```css
:root[data-theme="light"] {
  --color-bg: #f5f2eb;
  --color-surface: #ffffff;
  --color-text: #171e19;
  /* ... */
}

:root[data-theme="dark"] {
  --color-bg: #171e19;
  --color-surface: #272727;
  --color-text: #ffffff;
  /* ... */
}
```

#### c. Tailwind dark variant bridge

The `@custom-variant dark (&:is([data-theme="dark"] *))` directive in `globals.css` ensures Tailwind's `dark:` prefix works with the `data-theme` attribute:

```jsx
<div className="dark:bg-surface bg-white">
  {/* Adapts based on data-theme="dark" on <html> */}
</div>
```

#### d. Theme toggle

The theme toggle pill is CSS-driven (no React state flash). It reads `data-theme` from the blocking script in `layout.js`:

```css
:root,
:root[data-theme="light"] {
  --toggle-track-bg: #e5e7eb;
  --toggle-knob-bg: #9ca3af;
  --toggle-knob-x: translateX(0);
}
:root[data-theme="dark"] {
  --toggle-track-bg: #131d30;
  --toggle-knob-bg: #377dff;
  --toggle-knob-x: translateX(14px);
}
```

#### e. Dark-first default

The default `:root` block in `globals.css` holds dark-mode values. Light values activate via `prefers-color-scheme` or explicit `[data-theme="light"]`. This means the UI ships dark-first out of the box.
