# ADR-002: No TypeScript — Plain JavaScript

**Status:** Accepted  
**Date:** 2024-01

## Context

TypeScript provides static type checking and improves IDE tooling. However, it adds a compilation step, complicates scaffolded project ownership (generated code needs tsconfig, build pipelines, and declaration files), and raises the contribution barrier — especially for developers from non-TypeScript backgrounds.

Quark's core value proposition is a low-friction starting point for production apps. Scaffolded projects are owned by their teams and should be as approachable as possible.

## Decision

All Quark packages and the reference app use plain `.js` and `.jsx` files with no TypeScript compilation. Type safety at system boundaries is enforced via Zod schemas at runtime.

JSDoc comments are used where IDE type hints are valuable (e.g. function signatures in `@techstream/quark-core`).

## Consequences

**Positive:**
- Lower contribution barrier — any JavaScript developer can contribute
- No build step for source files; `node --test` runs tests directly
- Scaffolded projects have no tsconfig or declaration file overhead
- Runtime validation (Zod) catches the errors that matter most — invalid external input

**Negative:**
- No compile-time type checking; logic errors must be caught by tests
- IDE refactoring tooling (rename symbol, etc.) is less precise than in TypeScript
- Large teams used to TS may find the lack of types uncomfortable initially
