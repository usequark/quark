---
"@techstream/quark-create-app": minor
---

feat: scaffold opinionation reduction — API-first, two-view CLI, minified admin + verticals

Quark becomes API-first with AI-assisted scaffolding:

- **Two-view CLI**: Human View (product-shaped questions + advanced config) and AI View (`--features`, `--preset`, `--prompt`, `--no-prompts`), plus a `recipe <feature>` command that prints an AI prompt recipe.
- **Minified admin**: neutral operations shell (`_patterns/` Dashboard/ActionForm/DeployPanel + auto-CRUD fallback), no themed UI imports, no design-language leak into user pages.
- **Verticals → domain starters**: bookings/crm/cms/ai are now generic endpoint + Prisma model + recipe, scaffolded on demand instead of full packages.
- **Prompt Library**: `recipes/` core set (add-model, add-endpoint, add-dashboard) + per-feature recipes.
- **`MAIN.md`**: single agent entry point linking CLAUDE.md, docs/, openapi.yaml, and recipes/.
- **Package scope reduction**: verticals removed from the default feature list; originals archived to `reference/`.
- **Fixes**: pass model name to `isListVisible` so per-model hidden fields are honored; fix `MAIN.md` brief placeholder replacement.
