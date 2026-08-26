# @yourscope/ui

Scaffolded UI primitives for your Quark project.

> This package is scaffolded via `quark-create-app`. There is no version sync back to Quark after scaffolding.

## Import

```javascript
import { Button, Card, Badge } from '@yourscope/ui';
```

## Available Components

| Component | Type | Notes |
|---|---|---|
| `Button` | server | `variant`, `size`, `icon`, `href` props |
| `Input` | server | Native input attributes |
| `Label` | server | Native label attributes |
| `Textarea` | server | Native textarea attributes |
| `Select` | server | `children`, `value`, `onChange` |
| `Checkbox` | server | Native checkbox attributes |
| `Badge` | server | `variant`: default/primary/success/warning/danger/info |
| `Card` / `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` | server | Composition primitives |
| `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` | server | Data tables |
| `Skeleton` | server | Loading placeholders |
| `ErrorBanner` | server | Inline error feedback |
| `Footer` | server | Public site footer |
| `Navbar` / `MobileNavbar` | server | Public navigation shells |
| `RichText` | client | Rich text editor |
| `Dialog` | client | Modal dialogs |
| `Toast` / `useToast` | client | Notifications |
| `ThemeProvider` / `useTheme` | client | Dark/light mode context |

## Rules

- All styling via Tailwind CSS utility classes.
- Import from `@yourscope/ui` — never from `@/components/ui/*`.
- Every component accepts `className` for Tailwind overrides.
- Server Components are the default — add `"use client"` only when using hooks or browser APIs.

## Theming

CSS variables in `globals.css` drive all component styles. Override tokens to retheme without editing component source. See `globals.css` in your web app for the full token reference.
