---
"@techstream/quark-core": patch
---

Add worker service resilience utilities and preflight health checks:

- **New Utilities:**
  - `isConnectionError()` — Detect connection failures (ECONNREFUSED, ECONNRESET, ENOTFOUND, ETIMEDOUT, etc.)
  - `throttledError()` — Deduplicate identical errors within time window to prevent log spam during outages
  - `waitForRedis()` — Retry health checks with exponential backoff before worker startup

- **New Features:**
  - `preflight()` mode for deployment readiness checks (health check via `--preflight` flag)
  - Graceful shutdown with 30-second drain timeout
  - Comprehensive error classification for connection vs. job processing errors

- **Testing:**
  - 17 new test cases covering all resilience utilities
  - Full coverage of error detection, throttling, and health check patterns
  - All tests passing (31 total)

- **Documentation:**
  - Complete README with architectural patterns and deployment examples
  - Code examples for integration and testing
  - Development experience improvements with local setup guidance
