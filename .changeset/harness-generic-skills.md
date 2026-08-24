---
"@techstream/quark-create-app": minor
---

feat: make embedded skills harness-generic via --harness flag

The embedded skills are no longer opencode-specific. The CLI now accepts a
`--harness <opencode|claude|copilot>` flag (default `opencode`) and places the
skills in the selected harness's auto-load directory (`.opencode/skills/`,
`.claude/skills/`, or `.github/skills/`). The scaffolded docs and feature rows
reference the selected harness's skill directory.
