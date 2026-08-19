# Reference Archive

This directory archives the **original full vertical packages** that were demoted to minified domain starters (D8). The originals are preserved here as recipe source and a validation oracle — do not delete them.

## What's here

| Path | Original | Now |
|------|----------|-----|
| `verticals/crm/` | Full CRM package (`@techstream/quark-crm`) | Starter: `packages/cli/templates/starters/crm/` + `recipes/crm.md` |
| `verticals/cms/` | Full CMS package (`@myquark/cms`) | Starter: `packages/cli/templates/starters/cms/` + `recipes/cms.md` |
| `verticals/ai/` | Full AI package (`@myquark/ai`) | Starter: `packages/cli/templates/starters/ai/` + `recipes/ai.md` |
| `verticals/crm-routes/` | CRM admin routes | Reference only |
| `verticals/cms-routes/` | CMS admin routes | Reference only |
| `verticals/cms-public/` | CMS public pages | Reference only |
| `verticals/ai-routes/` | AI admin routes | Reference only |

## Why

The verticals were over-built — full implementations where most users need a generic starting point. They are now **minified domain starters**: a generic endpoint + Prisma model + a recipe that documents the extension path. The domain logic from the originals lives on in the recipes and this archive.

## How to use

- **Recipe source:** when extending a starter, consult the corresponding `verticals/<vertical>/` source for the full implementation patterns.
- **Validation oracle:** the archived originals are the reference for what a complete vertical looks like.
