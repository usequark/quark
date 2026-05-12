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
Props: `className`, `children` (option elements), all native select attributes.

### Checkbox
Props: `id`, `label` (string), `className`, all native checkbox input attributes.

### Badge
Props: `variant` ('default' | 'success' | 'warning' | 'danger' | 'info', default: 'default'), `className`.

### Card / CardHeader / CardTitle / CardContent / CardFooter
Composable card container. All parts accept `className`.

### Table / TableHeader / TableBody / TableRow / TableHead / TableCell
Composable table. `Table` wraps in a scrollable container. All parts accept `className`.

### Skeleton
Props: `className` (use to set width/height for the placeholder shape).

### Dialog
`"use client"` — Props: `open` (bool), `onClose` (fn), `title` (string), `children`, `className`.

### Toast / useToast
`"use client"` — `Toast` props: `message`, `variant` ('default' | 'success' | 'error'), `onClose` (fn), `visible` (bool).  
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
- Server Component compatible except Dialog and Toast (marked `"use client"`).
- Accessible: ARIA attributes, focus management on interactive elements.
