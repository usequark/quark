---
"@usequark/quark-create-app": patch
---

refactor(cli): overhaul base-project README template to match calibre-surveying style

The scaffolded README was 164 lines of dense onboarding content — scaffold
metadata, PWA docs, "First Files to Edit", "Feature Guides", internal CLI
commands, a 40-line Railway deploy section, and an AI-Assisted Development
prompt. It read like a manual, not a front door.

The new template is ~50 lines and mirrors the calibre-surveying README:
visual branding (logo, tagline, badges), Quick Start, Services table,
Development commands, Database table, Project Structure with inline comments,
Tech Stack bullets, and a License line. Scaffold metadata moves to an HTML
comment. Railway deploy instructions move to DEPLOYMENT.md. Onboarding docs
live in docs/ where they belong.
