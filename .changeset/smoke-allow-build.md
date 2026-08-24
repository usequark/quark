---
"@techstream/quark-create-app": patch
---

fix(smoke): approve msgpackr-extract build in standalone core check

pnpm 10+ ignores build scripts not explicitly allowed, so the standalone core
smoke check (`pnpm add @techstream/quark-core next react react-dom`) failed with
`ERR_PNPM_IGNORED_BUILDS` for the transitive `msgpackr-extract` dependency. The
smoke test now passes `--allow-build=msgpackr-extract`.
