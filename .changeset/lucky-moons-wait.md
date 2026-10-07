---
"@usequark/quark-core": patch
---

Remove named client projects from a source comment

`packages/core/src/db.js` credited the database utilities with replacing
per-project re-implementations in three named client engagements. The repo is
about to be made public, which would publish those names — and other people's
engagements — as a reference list.

The comment now describes what the utilities actually provide, which is what a
reader of the package needs to know anyway. Behaviour is unchanged; this is a
docstring edit.
