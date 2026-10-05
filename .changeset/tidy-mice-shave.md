---
"@usequark/quark-create-app": patch
---

Fix every theme colour utility in `@task/ui` silently doing nothing in dark mode.

Tailwind v4 removed the bare `[--var]` shorthand that v3 accepted, but a class
like `text-[--navbar-text-muted]` is still a *valid* utility name in v4. Tailwind
accepts it, emits a rule, and exits 0 — with the bare token as the declaration
value:

```css
.text-\[--navbar-text-muted\] { color: --navbar-text-muted; }
```

`--navbar-text-muted` is not a valid `<color>`, so the browser discards the
declaration and the element inherits instead. Nothing warns and the rule *is*
present in the stylesheet, so it cannot be caught by reading the CSS or the build
output. `body` sets no colour and the inherited default happens to be black,
which reads as correct in light mode and is unreadable in dark mode.

All 196 occurrences across 20 components are converted to the v4
`-(--var)` form. Measured with a real Tailwind 4.3.3 build of the actual
`globals.css` and component sources: 128 declarations emitted the bare token
before, 0 after. In Chromium, `text-(--navbar-text-muted)` computes to
`rgb(107,114,128)` in light and `rgb(141,158,192)` in dark, against a fixed
`rgb(0,0,0)` before.

A uniform substitution is sufficient here. The `--color-*` variables are
registered via `@theme inline`, but the unregistered ones (`--input-*`,
`--navbar-*`, `--card-*`) resolve correctly with the same `-(--var)` form —
Tailwind only needs an explicit `[color:var(--x)]` hint when a variable is used
as both a colour *and* a font size, and all 48 `text-[--…]` variables in the UI
package are colour tokens.

`scripts/check-standards.mjs` gains a check that rejects the v3 shorthand, so
this cannot silently return. It ships inside the CLI and already runs in
scaffolded projects. The pattern is anchored to an explicit list of value-typed
utilities rather than "any identifier before `[--x]`", which would also match
ordinary JavaScript such as `rows[--i]`.