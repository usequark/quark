---
"@usequark/quark-create-app": patch
---

Refuse admin self-deletion on `DELETE /api/users/[id]`, and return `401` rather
than an unhandled rejection when a CSRF check fails.

**Admin self-deletion is refused.** The route resolved its target purely from the
path segment and only checked the caller's role, so an admin could delete their
own row — and if they were the last admin, leave the deployment with nobody able
to administer it. The guard compares the session identity against the path
segment and returns `409`. It runs before the existence check, so a refused
request never reads from the database and cannot be used to probe which ids are
real.

This is a per-request guard, not a check on the remaining admin count. Two
concurrent deletes of the two last admins can still both pass it; enforcing that
invariant needs a transaction around the count and the delete.

**CSRF failures now return `401`.** `withCsrfProtection` calls
`requireCsrfToken` in its own wrapper, outside the route handler's `try`/`catch`,
so `handleError` never saw the rejection and the client got an unhandled
rejection instead of a status code. Fixed in `@usequark/quark-core`; see that
package's changeset.