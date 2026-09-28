---
"@techstream/quark-create-app": patch
---

Detect when a project would be scaffolded inside an existing git repository: warn that the project folder will sit one level below the repository root, and skip git initialisation so a nested repository is never created. Prevents broken pnpm workspaces, turbo and CI workflows caused by a nested project folder.
