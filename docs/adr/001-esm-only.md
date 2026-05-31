# ADR-001: ESM-only, No CommonJS

**Status:** Accepted  
**Date:** 2024-01

## Context

JavaScript has two module systems: CommonJS (CJS) and ECMAScript Modules (ESM). The Node.js ecosystem has been transitioning to ESM for several years. Mixing both systems in a single project creates friction: dual-mode packages require extra build configuration, `require()` of ESM modules fails, and interop shims add maintenance burden.

Quark targets Node.js 22+ and Next.js 16+, both of which have first-class ESM support.

## Decision

All packages in the Quark monorepo use `"type": "module"` in `package.json`. Only `import`/`export` syntax is permitted. `require()` and `module.exports` are forbidden.

## Consequences

**Positive:**
- Simpler, forward-looking codebase with no dual-mode complexity
- Static import analysis enables better tree-shaking in bundlers
- Consistent module semantics across all packages and apps

**Negative:**
- Some legacy npm packages that are CJS-only require dynamic `import()` workarounds
- Jest (ESM support is experimental) is incompatible — we use `node --test` instead
- Developers accustomed to CJS (`__dirname`, `require.resolve`) must use ESM equivalents (`import.meta.url`, `import.meta.resolve`)
