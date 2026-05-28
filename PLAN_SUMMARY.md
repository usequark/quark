# Quark Deployment Roadmap — Active Summary

> **Status update (May 2026):** This summary replaces the older admin/observe phase table as the active execution plan. Older phase notes are historical and are no longer the authoritative sequence for Quark's current work.

## Current Status

Phase 1 is complete. Quark now has a provider-neutral deploy substrate and an explicit OCI/runtime contract:

- `packages/cli/src/deploy/contract.js` and `packages/cli/src/deploy/discovery.js` define and discover deployable Quark services.
- Web and worker use normalized deploy scripts: `build:deploy`, `start:deploy`, and `db:migrate:deploy`.
- Web and worker Dockerfiles are pinned to the Node 22 Alpine runtime contract.
- Railway config uses the same build, release, and start contract as the Docker path.
- CI scans source images, and the scaffold build harness can optionally build and scan generated images too.

---

## Five-Phase Deployment Plan

| Phase | Work | Effort | Status |
|-------|------|--------|--------|
| **1** | Provider-neutral deploy substrate + OCI/runtime contract | 1-2 weeks | ✅ Complete |
| **2** | User-facing `quark deploy` CLI + Railway adapter | 1-2 weeks | Next |
| **3** | AWS adapter (`quark deploy aws`) | 2-3 weeks | Planning |
| **4** | Self-hosted / Docker CLI polish + provider expansion | 1 week | Planning |
| **5** | Quark Cloud (managed path built on the same contract) | 8-12 weeks | Deferred |

---

## Phase Details

### Phase 1: Deploy Foundation (Complete)

- Internal deploy contract and discovery in the CLI.
- Explicit web and worker entrypoints plus healthcheck expectations.
- Standardized `build:deploy`, `start:deploy`, and `db:migrate:deploy` contracts.
- Pinned web and worker Docker images with trimmed runtime surfaces.
- Required source-image scanning in CI.
- Optional generated-image build/scan harness for scaffolds.

### Phase 2: CLI UX + Railway (Next)

- Add a user-facing `deploy` command to `quark-create-app`.
- Support `quark deploy` inspection, validation, and dry-run behavior.
- Implement `quark deploy railway` on top of the existing `railway.json` and normalized scripts.
- Keep Dockerfiles and package scripts as the source of truth; the adapter should orchestrate them, not replace them.

### Phase 3: AWS (Planned)

- Implement `quark deploy aws`.
- Target ECR + ECS/Fargate + ALB + secrets/env wiring.
- Preserve the same web and worker images and the same release migration contract used elsewhere.
- Treat AWS as the stress test for the provider abstraction, not a parallel bespoke deployment path.

### Phase 4: Self-Hosted / Provider Expansion (Planned)

- Formalize a `quark deploy docker` or equivalent export-oriented self-hosted flow.
- Make self-hosted deployment first-class in docs.
- Add other provider adapters only after the CLI/provider API is stable.

### Phase 5: Quark Cloud (Deferred)

- Build Quark Cloud only after Railway and AWS prove the contract.
- Position Cloud as convenience, not lock-in.
- Keep Railway, Docker, and self-hosted equally valid paths in docs and CLI.

---

## Recommended Order

1. Railway first because the repo already has normalized scripts, Railway config, and validated deploy images.
2. AWS second because it exercises the abstraction against the highest-complexity mainstream target.
3. Quark Cloud after those two so the managed product inherits a proven contract instead of defining it prematurely.

---

## Out Of Scope For The Active Phases

- Reopening the older admin/observe sequence as the primary implementation roadmap.
- Treating Quark Cloud as the default deployment story before external-provider support is proven.
- Bundling the pnpm 11 migration into deploy work; that should stay a separate migration task.

---

**Reference:** See [PLAN.md](PLAN.md) for the detailed active deployment note and the retained historical planning archive.
