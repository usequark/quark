---
"@techstream/quark-create-app": patch
---

Stop pointing scaffolded projects at reference routes that no longer exist.

The `example-page` and `playground` routes were removed from the reference app,
but the shipped scaffold guidance still told agents to read them. The
`base-project` `README.md`, `.github/copilot-instructions.md`, and
`skills/quark-skills/SKILL.md` all referenced those two paths, so every newly
generated project inherited instructions pointing at files it never received.
`apps/web/src/app/page.js` is the only remaining public-page reference and is
what those three templates now cite.

The dead `EXCLUDE_PATTERNS` entries for the removed route directories were also
dropped from `sync-templates.js`; they no longer matched anything.