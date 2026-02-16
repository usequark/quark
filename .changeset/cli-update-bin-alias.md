---
"@techstream/quark-create-app": patch
---

fix: update CLI output and add `quark-update` bin alias

- Register `quark-update` as a bin alias so `npx quark-update` works
- Fix post-scaffolding output to show `npx @techstream/quark-create-app update`
