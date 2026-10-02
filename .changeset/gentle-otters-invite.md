---
"@techstream/quark-core": patch
"@techstream/quark-create-app": patch
---

Switch the project licence from ISC to MIT. MIT carries an explicit patent grant,
which ISC omits and which some corporate legal teams screen for when evaluating
a framework dependency.

Scaffolded projects now default to MIT as well, so a generated app inherits the
same terms as the framework that produced it. Archived reference verticals under
`docs/archive/` keep their original ISC markers as historical snapshots.
