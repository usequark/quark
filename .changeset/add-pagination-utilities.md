---
"@techstream/quark-core": minor
---

Add pagination utilities: `parsePagination`, `paginationToSkip`, `paginationMeta`, and `parsePaginationQuery`. These offset-based helpers integrate with Prisma's skip/take API and throw `ValidationError` on invalid input so existing route error handlers catch them automatically.
