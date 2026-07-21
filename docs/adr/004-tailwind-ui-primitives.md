# ADR-004: Tailwind-only UI Primitives (No Shadcn)

**Status:** Accepted  
**Date:** 2024-01

## Context

Quark needs a set of reusable UI components for the reference app and scaffolded projects. Options considered: Shadcn/ui (Radix + Tailwind), Headless UI, Radix Primitives standalone, and hand-written Tailwind components.

Shadcn/ui is popular but copies component source into the project (no package boundary), depends on Radix UI (adds client-side JS to every component), and requires TypeScript and a specific file structure.

Quark's UI components must be:
- Server Component-safe (no client-side JS by default)
- Zero external dependencies beyond Tailwind
- Safe to use in scaffolded projects that own their own UI layer

## Decision

`packages/ui` provides Tailwind-only, dependency-free UI primitives. No Radix, no Shadcn, no component libraries. Components that require client interactivity (`Dialog`, `Toast`, `ThemeProvider`) are explicitly marked `"use client"` and kept minimal.

## Consequences

**Positive:**
- All components are Server Component-safe by default
- No JavaScript bundle overhead for layout/display components
- Scaffolded projects own the full UI layer with no upstream coupling
- Easy to understand, modify, and style - no abstraction layers

**Negative:**
- No accessibility primitives from Radix (focus traps, ARIA patterns must be hand-rolled)
- More limited than a full component library - complex components (data tables, comboboxes) must be built by app developers
- No animation library integration by default
