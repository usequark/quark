---
"@usequark/quark-create-app": patch
---

Clear the remaining auto-fixless security advisories in scaffolded projects: bump the pinned
`next` to `16.4.5` (GHSA-vc7v-qv4w-wrv8, GHSA-mfr8-8qww-v76h), and add override floors for
`glob >=14.0.2` (GHSA-3g3m-2fjr-6pw4) and `minimatch >=11.0.1` (GHSA-g3hv-75wg-m249). The
`pnpm-workspace.yaml` override floors are copied verbatim into the scaffold template and the
lockfile is refreshed; no source API changed.
