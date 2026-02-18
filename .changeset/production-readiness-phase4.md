---
"@techstream/quark-create-app": minor
"@techstream/quark-core": patch
---

## Production-Readiness Update

### @techstream/quark-create-app (minor)

Enhanced template synchronization and CLI initialization with improved production-readiness features:

- **New sync-templates.js script**: Robust template synchronization with proper configuration merging and file handling
- **Updated CLI initialization**: Improved biome configuration handling and template scaffold generation  
- **Template enhancements**: 
  - Added GitHub workflows for CI, auto-merge, and release management
  - Improved environment configuration with production SMTP settings
  - Enhanced seed script with user seeding functionality and audit log handling
  - Added validation for email provider and storage options
  - Support for Resend and S3 storage providers in config templates

### @techstream/quark-core (patch)

- **Code refactoring**: Reorganized testing factories module for improved maintainability
- **No API changes**: All exports and functionality remain stable

## Related Issues

Completes all phases of the production-readiness review plan:
- Phase 1: Critical Security (10 items) ✅
- Phase 2: High Severity (6 items) ✅  
- Phase 3: Medium Severity (8 items) ✅
- Phase 4: Low Severity/Polish (5 items) ✅

## Breaking Changes

**Note**: The core database package has breaking changes (Post model removed), but since `@<app>/db` is scaffolded locally (not published to npm), no version bump is required. The removal is reflected in template updates provided by the updated CLI.
