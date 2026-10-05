---
"@usequark/quark-create-app": patch
---

Mount `ThemeProvider` in the scaffolded root layout and make a missing provider
fail loudly.

`packages/ui/src/theme.js` exports `ThemeProvider`, `useTheme` and
`ThemeToggle`, and they are documented as public API in `CLAUDE.md`,
`docs/ARCHITECTURE.md` and `docs/QUARK_USAGE.md` — but `layout.js` never
mounted the provider. Nothing raised, so nothing looked wrong.

The failure mode was worse than a missing feature. `ThemeCtx` defaulted to
`{ theme: "dark", setTheme: () => {} }` and `useTheme()` returned that default
instead of complaining, so `ThemeToggle` — documented as "Must be rendered
inside a ThemeProvider" — rendered a real, focusable, correctly-labelled button
that did nothing on click and always read "Dark Mode" regardless of the actual
theme. The home page was unaffected because it uses a separate
`HomeThemeToggle` that drives `localStorage` and dispatches `THEME_CHANGE_EVENT`
directly; that component is kept, and the provider already listened for the
event.

Measured on `main` before the change by rendering a bare `ThemeToggle` under
jsdom and clicking it: `data-theme` stayed `dark`, `localStorage` was never
written, and not one error was logged. The identical component inside a
provider flipped `dark` → `light`.

`RootLayout` now wraps `{children}` in `<ThemeProvider>`. The provider emits no
markup, so it cannot affect layout, and its `useLayoutEffect` runs after
hydration — the blocking pre-paint script in `<head>` and `suppressHydrationWarning`
are unchanged. `useTheme()` now throws when no provider is above it, so the same
mistake surfaces on the first render instead of shipping a dead button.

`packages/ui/src/theme.test.js` is the first test in that package to render the
theme system at all — every previous theme-adjacent test asserted only the
export contract, which is why #6 was invisible. It proves a toggle click moves
`data-theme`, that the choice persists, that an out-of-tree
`THEME_CHANGE_EVENT` still syncs React state, and that rendering without a
provider throws. Verified to fail 2 of 9 when the old no-op default is
restored. `apps/web/src/app/layout-theme.test.js` pins the wiring and fails when
the wrapper is removed. Two harness facts are documented in that file: jsdom
implements no `matchMedia`, and Node has no `localStorage` global.