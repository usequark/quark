# Reference Archive

This directory archives the **original full vertical packages** that were demoted to skill-only verticals (D8). The originals are preserved here as reference source and a validation oracle — do not delete them.

## What's here

| Path | Original | Now |
|------|----------|-----|
| `verticals/bookings/` | Full bookings package (`@techstream/quark-bookings`) | Skill: `<harness>/skills/bookings/SKILL.md` |
| `verticals/crm/` | Full CRM package (`@techstream/quark-crm`) | Skill: `<harness>/skills/crm/SKILL.md` |
| `verticals/cms/` | Full CMS package (`@myquark/cms`) | Skill: `<harness>/skills/cms/SKILL.md` |
| `verticals/ai/` | Full AI package (`@myquark/ai`) | Skill: `<harness>/skills/ai/SKILL.md` |
| `verticals/crm-routes/` | CRM admin routes | Reference only |
| `verticals/cms-routes/` | CMS admin routes | Reference only |
| `verticals/cms-public/` | CMS public pages | Reference only |
| `verticals/ai-routes/` | AI admin routes | Reference only |

## Why

The verticals were over-built — full implementations where most users need a generic starting point. They are now **skill-only**: the embedded skills carry the domain knowledge and the AI builds the system on demand. The domain logic from the originals lives on in the skills and this archive.

## How to use

- **Reference source:** when building a vertical, consult the corresponding `verticals/<vertical>/` source for the full implementation patterns.
- **Validation oracle:** the archived originals are the reference for what a complete vertical looks like.
