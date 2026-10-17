---
"@usequark/quark-create-app": patch
---

Remove dead direct-mode fallback in web-vitals dispatch and fix a stale rewrite reference in a config comment. No behavior change: the client config carries no upstream URL, so the fallback could never fire.
