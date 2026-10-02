# Quark Merge Plan — scaffold opinionation reduction → `main`

> Status: Draft for review
> Date: August 2026
> Companion: [DESIGN_NOTES.md](../DESIGN_NOTES.md), [FEATURE_PLAN.md](./FEATURE_PLAN.md)

## 1. Current State

| PR | Lane | Base | Status |
|----|------|------|--------|
| #64 | Plan docs | `main` | MERGED |
| #66 | C (F7 logo, F1 MAIN.md) | `quark-scaffold-opinionation` | MERGED |
| #67 | B (F3 admin shell, F8 decouple) | `quark-scaffold-opinionation` | MERGED — **fragile** |
| #68 | A (F2 skills, F4 starters, F6 scope, F5 CLI) | `quark-scaffold-opinionation` | MERGED |

All lane work is on `quark-scaffold-opinionation`. Diff vs `main`: **162 files, +3087 / −3946**.

## 2. Blocker: F3 admin shell is template-only (must fix before merge)

`sync-templates.js` maps `apps/web/src/app/admin` → `packages/cli/templates/admin-routes`. The F3 lane rebuilt the **template** directly, but the **source** still has the old themed admin. Running the sync **reverts the F3 work** (deletes `_patterns/`, restores old `_components/`). CI runs sync on release, so the work would be destroyed.

**Durability audit (all lane changes):**

| Change | Location | Durable? |
|--------|----------|----------|
| F3 admin shell | `packages/cli/templates/admin-routes/` | ❌ **NO — redo in source** |
| F7 logo | `apps/web/src/app/page.js` (source) | ✅ template == source |
| F1 MAIN.md | `base-project/MAIN.md` (outside synced dest) | ✅ preserved |
| F2 skills/ | `base-project/skills/` (outside synced dest) | ✅ preserved |
| F4 starters/ | `templates/starters/` (not in sync map) | ✅ preserved |
| F4 reference/ | repo root | ✅ preserved |
| F5/F6 CLI | `packages/cli/` (not templates) | ✅ preserved |

**Only F3 needs rework.**

## 3. Merge Sequence

### Phase 0 — Redo F3 in source (Lane B worker)

Rebuild the neutral admin operations shell in the **source**, then sync:

1. Rebuild `apps/web/src/app/admin/` to the neutral shell:
   - `layout.js`, `page.js` (dashboard), `[model]/` (auto-CRUD fallback), `_actions/crud.js`
   - `_patterns/Dashboard.js`, `_patterns/ActionForm.js`, `_patterns/DeployPanel.js`
   - Remove old themed `_components/` (AdminThemeToggle, ModelForm, ModelTable, FieldRenderer, FormActionWrapper, Sidebar, SignOutButton, AdminImageField, AdminActionToast, AdminImagePicker) and `settings/`, `workflows/`
   - Neutral Tailwind only — no `@techstream/quark-ui` imports
2. Run `node packages/cli/scripts/sync-templates.js` to regenerate `admin-routes/`.
3. Confirm the two dead files (`_components/AdminActionToast.js`, `_components/AdminImagePicker.js`) are gone from the template (source no longer has them).
4. Open PR → merge into `quark-scaffold-opinionation`.

**Gate:** `sync-templates --check` passes clean; admin renders neutral; no quark-ui imports.

### Phase 1 — Verify the whole branch

On `quark-scaffold-opinionation` (after Phase 0 merges):

- [ ] `pnpm install` (deps present)
- [ ] `pnpm lint` (Biome)
- [ ] `pnpm test` (requires Docker: `docker compose up -d`)
- [ ] `node packages/cli/scripts/sync-templates.js --check` → clean
- [ ] Scaffold smoke test: `node packages/cli/scripts/smoke-published.js`
- [ ] Confirm preserved: `skills/`, `starters/`, `MAIN.md`, `reference/` all present in a scaffold

### Phase 2 — Merge to `main`

1. Open PR `quark-scaffold-opinionation` → `main`.
2. Review the 162-file diff (focus: admin-routes now source-backed, skills/starters/MAIN.md added, verticals moved to `reference/`, CLI two-view + `skill` command).
3. Merge (squash or merge — follow repo convention).

## 4. Rollback

- The plan docs (#64) are already in `main` and are safe to keep regardless.
- If the admin rework is rejected, revert Phase 0 only; the rest of the lane work is independent and durable.
- `reference/` preserves the original verticals, so nothing is lost if a vertical needs to be restored.

## 5. Post-merge

- Confirm CI release pipeline runs `sync-templates` without reverting the admin shell.
- Optional cleanup: remove the now-dead `_components/` files if any remain.
