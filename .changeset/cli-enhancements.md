---
"@techstream/quark-create-app": minor
---

Add flexible CLI options and comprehensive test coverage for project scaffolding:

- **New CLI Flags:**
  - `--no-prompts` — Non-interactive project creation for CI/CD and automation
  - `--features <list>` — Selective package scaffolding (default: `ui,jobs`; valid: `ui`, `jobs`)
  - `--skip-install` — Skip `pnpm install` step during scaffolding for faster iterations
  - `--skip-docker` — Skip Docker volume cleanup for development workflows

- **New Testing Infrastructure:**
  - Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
  - Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
  - GitHub Actions workflow (`cli-e2e-full.yml`) for automated testing on CLI changes

- **Improvements:**
  - HTTP health check timeout increased from 10s to 30s for reliability in slow environments
  - Parallel Docker service startup with `--wait` flag support
  - Removed unused internal variables and corrected log output typos

- **Database Seeding:**
  - Added `prisma/seed.js` with test user and sample data generation
  - Seeding support in both monorepo and scaffolded templates
  - Enhanced CLI to manage database initialization seamlessly

- **Performance Monitoring:**
  - New `check:perf` script with structured JSON output
  - Threshold-based performance checks for E2E workflows
