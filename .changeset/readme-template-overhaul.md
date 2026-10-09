---
"@usequark/quark-create-app": patch
---

refactor(cli): overhaul base-project README template to match calibre-surveying style

The scaffolded README was 164 lines of dense onboarding content — scaffold
metadata, PWA docs, "First Files to Edit", "Feature Guides", internal CLI
commands, a 40-line Railway deploy section, and an AI-Assisted Development
prompt. It read like a manual, not a front door.

The new template is ~55 lines and mirrors the calibre-surveying README:
a branding block (logo, tagline, tech badges), Quick Start, Services table,
Development commands, Database table, Project Structure with inline comments,
Tech Stack bullets, and a Deployment pointer. Scaffold metadata moves to an
invisible HTML comment. Railway deploy instructions move to a new
DEPLOYMENT.md. Onboarding docs stay in docs/ where they belong.

The branding block is seeded from data the CLI already collects: the logo
points at apps/web/public/quark.svg (the Quark mark the scaffold already
ships as a stand-in icon) and the tagline is the project brief captured by
--prompt or the interactive prompt. Both are placeholders on purpose — the
doctor now reports them:

- check S6 ("README branding block is still the Quark default") warns while
  the logo still points at quark.svg or the tagline is still the default
  "<name> application", and says what to swap in
- check E7 ("README still contains references to Quark") no longer fires on
  the invisible scaffold comment or the stand-in logo src, so it only reports
  Quark references the author actually wrote into the README
