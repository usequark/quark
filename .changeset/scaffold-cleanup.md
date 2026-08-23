---
"@techstream/quark-create-app": patch
---

fix(scaffold): remove demoted vertical refs from base template; fix starter paths; add --skip-install to add

- Removed orphaned references to the demoted vertical packages (`quark-ai`, `quark-cms`, `quark-crm`) from the base scaffold (web/worker `package.json`, `next.config` transpilePackages, `api/ai` + `api/admin/crm` routes, worker `ai.js`/`ai.test.js`). These are now AI skills, not scaffolded packages.
- Fixed a wrong relative import in all four domain starters (`bookings`, `crm`, `cms`, `ai`): `route.js` used `../../error-handler` (resolved to `app/error-handler`, wrong) instead of `../error-handler`. This broke `pnpm build`.
- Added `--skip-install` support to the `add` command (previously ignored due to a commander option-shadowing quirk), fixing a flaky `add <feature>` test that timed out during dependency installation.
