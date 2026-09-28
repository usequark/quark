---
"@techstream/quark-create-app": patch
---

Bump 16 minor dependencies, including next 16.3.6, react 19.3.0 and rrweb 2.1.6

From dependabot's semver-aware `production-minor` group. Notable:

- **rrweb 2.0.0-alpha.4 → 2.1.6** — the replay recorder's first non-prerelease.
  `record()` keeps the same signature, and every option Quark passes
  (`inlineStylesheet`, `slimDOMOptions` with its 8 `headMeta*`/`comment` keys,
  `recordCanvas`, `recordCrossOriginIframes`, `checkoutEveryNms`) is still
  present in the 2.1.6 runtime bundle.
  `test-build.js` asserted the exact rrweb version, so it is updated to match.
- **next 16.1.6 → 16.3.6**, **react/react-dom 19.2 → 19.3**, **zod 4.3.6 → 4.6.5**,
  **jose 6.0.11 → 6.2.12**, **pg 8.20 → 8.23**, **@aws-sdk/client-s3 3.1004 → 3.1140**,
  **lucide-react 1.14 → 1.48**, **fs-extra 11.3 → 11.4**, plus type-only and
  mobile packages.

Verified: `test:build` completes both the default and pwa scenarios end to end
(scaffold, install, migrate, Docker build) with the synced templates;
`pnpm test` 9/9; lint and template drift clean.
