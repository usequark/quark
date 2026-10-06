---
"@usequark/quark-create-app": patch
---

Initialise scaffolded repositories on `main` instead of inheriting the machine's default branch

`initializeGit` ran a bare `git init`, which inherits `init.defaultBranch` from
the machine's global git config. That setting is unset almost everywhere, and git
then falls back to `master` and prints a hint nobody reads — so the same published
CLI produced a scaffold on `master` in one terminal and on `main` in another. The
scaffold was not reproducible, and neither were the README's
`git push -u origin main` instructions.

`git init -b main` pins the branch name, matching the name GitHub defaults a new
repository to. Falls back to a bare `init` on git older than 2.28, which still
produces a working repository using git's own default.