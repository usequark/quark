---
"@usequark/quark-core": patch
---

Fix `redactUrl()` leaking credentials from a message that itself parses as a URL.

The fallback added for embedded URLs was unreachable for a common class of
input. `redactUrl()` tried `new URL()` first and rewrote the parsed result field
by field — but `new URL()` accepts *any* string with a `<scheme>:` prefix, so a
driver error that begins with a label parses as a URL carrying no credentials of
its own. The function then found nothing to strip and returned the message whole,
with the embedded password intact:

```
Error: getaddrinfo ENOTFOUND postgres://u:p@db.example.com:5432/x
  before: unchanged, password returned
  after:  Error: getaddrinfo ENOTFOUND postgres://REDACTED@db.example.com:5432/x
```

The same held for any `label:` prefix — `connect:`, `error:`, `failure:`. This
reached `/api/health`, which returns probe messages from an unauthenticated
endpoint: `runHealthChecks()` routes both rejection and resolved-error shapes
through `redactUrl()`, and a probe failing with `connect: ECONNREFUSED
redis://user:pass@host:6379` returned the password verbatim outside production.

The field-by-field path is now gated on the string actually being a bare URL
(`scheme://…` with no surrounding text). Everything else goes to the substring
scan, which handles bare and embedded inputs identically. This completes the fix
in #226, which closed the start-anchored regex but left this branch ahead of it.

Credential-free input is still returned unchanged.