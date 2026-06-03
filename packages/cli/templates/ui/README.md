# @yourscope/ui

Scaffolded UI primitives for your Quark project. These components are **yours** — modify, extend, or replace them freely.

> This package is scaffolded via `quark-create-app`. There is no version sync back to Quark after scaffolding.

## Import

```javascript
import { Button, Card, Badge } from '@yourscope/ui';
```

## Components

### Button
Props: `variant` ('primary' | 'secondary' | 'danger' | 'ghost', default: 'primary'), `size` ('sm' | 'md' | 'lg', default: 'md'), `className`, all native button attributes.

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

### Table / TableHeader / TableBody / TableRow / TableHead / TableCell
Composable table. `Table` wraps in a scrollable container. All parts accept `className`.

### Skeleton
Props: `className` (use to set width/height for the placeholder shape).

### ErrorBanner
Props: `message`, `className`. Returns `null` when `message` is empty.

### RichText
`"use client"` — dependency-free rich text editor built on `contentEditable`.
Props: `id`, `name`, `defaultValue`, `placeholder`, `disabled`, `required`, `rows`, `className`, `onChange`.

### Dialog
`"use client"` — Props: `open` (bool), `onClose` (fn), `title` (string), `children`, `className`.

### Toast / useToast
`"use client"` — `Toast` props: `message`, `variant` ('default' | 'success' | 'error'), `onClose` (fn), `visible` (bool).  
`useToast()` returns `{ show(message, variant?), hide, toastProps }`. Spread `toastProps` onto `<Toast />`.

### Footer
Standardized multi-column site footer with brand block, CTA, links, and legal bottom bar.
Props include: `brandName`, `brandDescription`, `ctaLabel`, `ctaHref`, `columns` (3-column array), `copyrightText`, `legalLinks`, `poweredByText`, `poweredByHref`, `mark`, `className`.

### PhotoGallery
`"use client"` responsive image gallery with optional lightbox overlay.
Props include: `images` (array of image objects or strings), `columns` (1-4), `lightbox` (bool), `showCounter` (bool), `className`, `thumbnailClassName`.
Image object shape: `{ src, thumbnailSrc?, alt?, caption? }`.
Keyboard support in lightbox: `Escape`, `ArrowLeft`, `ArrowRight`.

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
- Client-only components: `Dialog`, `Toast`, `useToast`, `Select`, `RichText`, `Navbar`, `MobileNavbar`, `ThemeProvider`, `useTheme`.
- Accessible: ARIA attributes, focus management on interactive elements.

## Example references
- Public-page example: `apps/web/src/app/example-page/page.js`
- Full component reference: `apps/web/src/app/playground/page.js`
