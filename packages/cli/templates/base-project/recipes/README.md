# Prompt Library (`recipes/`)

This directory is a library of **feature recipes** — markdown specs an AI agent (or a human) executes against this project's Quark conventions. Each recipe says *what it builds, which files it creates, the patterns to follow, and the exact prompt to paste*.

Recipes are the vibe-coder differentiator: they carry the domain knowledge that used to live in full feature packages, so you get a reliable starting point without the overhead.

## How to use a recipe

1. Pick the recipe that matches the feature you want: `add-model.md`, `add-endpoint.md`, `add-dashboard.md`, or a vertical recipe (`bookings.md`, `crm.md`, `cms.md`, `ai.md`).
2. Paste the **Prompt to paste** section into your AI tool (Claude Code, Cursor, Copilot, etc.), or follow the steps by hand.
3. The recipe's `files` list is the contract — it tells the agent exactly what to create and lets the CLI validate the result.

You can also pull a recipe from the CLI:

```bash
npx @techstream/quark-create-app recipe <feature>
```

## How to write a recipe

Every recipe uses the format in [`_TEMPLATE.md`](./_TEMPLATE.md): YAML frontmatter (name, feature, files, depends) plus a markdown body (what it builds, files created, patterns to follow, prompt to paste).

Rules:

- **Frontmatter `files` is the contract.** List every file the recipe creates, relative to the project root. The CLI uses this to validate a recipe produced the right output.
- **Follow Quark conventions.** ESM only, no authored TypeScript, `AppError`/`ValidationError` from `@techstream/quark-core/errors`, `createLogger()` for logging, Zod for every Server Action and API route, `createdAt`/`updatedAt` on every Prisma model.
- **Be generic.** A recipe is a starting point, not a full implementation. Document the extension path; let the user or AI build the 20%.
- **Keep it flat and discoverable.** One recipe per feature, named `<feature>.md`.

## Core set

| Recipe | Builds |
|--------|--------|
| [`add-model.md`](./add-model.md) | A Prisma model + query helpers |
| [`add-endpoint.md`](./add-endpoint.md) | A CRUD endpoint |
| [`add-dashboard.md`](./add-dashboard.md) | A decision dashboard in admin |

Vertical recipes ship with their feature: `bookings.md`, `crm.md`, `cms.md`, `ai.md`.
