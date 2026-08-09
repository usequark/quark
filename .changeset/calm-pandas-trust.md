---
"@techstream/quark-core": patch
---

Auth: `isDeployed()` now honors `AUTH_TRUST_HOST` only when set to the literal string `"true"` — previously any truthy value (including `"false"`) enabled `trustHost`