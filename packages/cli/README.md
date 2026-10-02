# @techstream/quark-create-app CLI

Scaffold a new Quark project with sensible defaults for full-stack JavaScript development.

## Installation

```bash
# Interactive — prompts for project name, description, and options
npx @techstream/quark-create-app@latest

# Non-interactive — provide project name as argument
npx @techstream/quark-create-app@latest my-awesome-app
```

The CLI scaffolds a complete project structure with:
- **Next.js** web application
- **Prisma** database schema and migrations
- **BullMQ** job queues
- **Docker Compose** setup (PostgreSQL, Redis, Mailpit)
- **JavaScript** monorepo with `pnpm` workspaces

## Quick Setup

```bash
cd my-awesome-app
docker compose up -d
pnpm db:migrate
pnpm dev
```

## Scaffolding into an existing repository

The scaffolder creates a new project folder and initialises a git repository inside it. Run it from inside an existing git repository and the project lands one level below that repository's root — where pnpm workspaces, turbo and GitHub Actions cannot see `package.json`, breaking installs and CI.

The CLI detects this, prints a warning, and skips git initialisation so a nested repository is never created. Recommended alternatives:

- Scaffold outside the repository, then push the project as its own repository.
- Scaffold into a temporary folder, then move the files to the repository root before the first commit.

## Commands

```bash
# Create a new project (interactive or with name argument)
npx @techstream/quark-create-app@latest
npx @techstream/quark-create-app@latest my-app

# Add a package to an existing project
npx @techstream/quark-create-app add jobs

# Print an embedded skill for a feature
npx @techstream/quark-create-app skill bookings

# Update Quark packages in an existing project
npx @techstream/quark-create-app update

# Check for available updates without applying them
npx @techstream/quark-create-app update --check

# Report drift in scaffold-managed files without overwriting anything
npx @techstream/quark-create-app update --scaffold-check

# Fail CI when scaffold drift is detected
npx @techstream/quark-create-app update --scaffold-check --fail-on-drift
```

Aliases:
- `quark-create-app`
- `create-quark-app`
- `quark-update`

## Interactive Mode

When run without arguments, the CLI prompts for:

1. **Project name** — becomes the directory name, npm scope, and env vars
2. **Description** — seeds `MAIN.md` and `.env` `APP_NAME`/`APP_DESCRIPTION`
3. **Background jobs** — include BullMQ worker for emails, webhooks, scheduled tasks
4. **Public signup** — allow self-service user registration

```bash
npx @techstream/quark-create-app@latest
# ? Project name: my-app
# ? Describe your app: A platform for booking salon appointments
# ? Include background jobs (emails, webhooks, scheduled tasks)? Yes
# ? Allow public self-service signup? Yes
```

## Non-Interactive Mode

Skip all prompts with flags:

```bash
npx @techstream/quark-create-app@latest my-app --no-prompts
```

### Packages

Specify which optional packages to include (default: `ui,jobs`; valid: `ui`, `jobs`):

```bash
# Only include UI package
npx @techstream/quark-create-app@latest my-app --no-prompts --packages ui

# Include both UI and Jobs
npx @techstream/quark-create-app@latest my-app --no-prompts --packages ui,jobs

# Minimal setup (no optional packages)
npx @techstream/quark-create-app@latest my-app --no-prompts --packages ""
```

`ui` is always included automatically as a required dependency.

### Product brief

Seed the `MAIN.md` brief from a flag:

```bash
npx @techstream/quark-create-app@latest my-app --no-prompts --prompt "A booking platform for salons"
```

### Signup

Control public self-service signup (default: `enabled`):

```bash
npx @techstream/quark-create-app@latest my-app --no-prompts --signup disabled
```

### skill command

Print an embedded skill for a feature:

```bash
# Print the bookings skill
npx @techstream/quark-create-app@latest skill bookings

# Print a core skill (model, endpoint, dashboard)
npx @techstream/quark-create-app@latest skill model
npx @techstream/quark-create-app@latest skill endpoint
npx @techstream/quark-create-app@latest skill dashboard
```

Available skills: `model`, `endpoint`, `dashboard`, `bookings`, `crm`, `cms`, `ai`.

### Skip Installation Steps

Create the project structure without running package installation:

```bash
# Create project but skip pnpm install
npx @techstream/quark-create-app@latest my-app --no-prompts --skip-install

# Useful for CI/CD where you'll install dependencies separately
```

### Docker Cleanup

Control whether to remove Docker volumes from previous cleanup:

```bash
# Keep Docker working directories (useful in CI/CD)
npx @techstream/quark-create-app@latest my-app --no-prompts --skip-docker
```

### Complete Example: Full Automation

```bash
# Create, install, and setup everything automatically
npx @techstream/quark-create-app@latest my-app \
  --no-prompts \
  --packages ui,jobs \
  && cd my-app \
  && docker compose up -d \
  && pnpm db:migrate \
  && pnpm dev
```

## Common Tasks

- **Update Quark packages**: `quark-update` or `pnpm update @techstream/quark-*`
- **Check for updates**: `quark-update --check`
- **Review scaffold drift**: `quark-update --scaffold-check`
- **Fail CI on scaffold drift**: `quark-update --scaffold-check --fail-on-drift`
- **Configure environment**: Edit `.env` file (see `.env.example`)

## CLI Testing

```bash
# Lightweight template checks
pnpm test

# E2E scaffold simulation
pnpm test:e2e

# Full build verification (opt-in)
QUARK_CLI_BUILD_TEST=1 pnpm test:build
```

## Troubleshooting

- **pnpm install fails**: Ensure `pnpm` is installed and Node.js >= 22.
- **Prisma generate fails**: Run `pnpm --filter db db:generate` inside the project.
- **Docker ports conflict**: The CLI auto-selects free ports. Check `.env` for assigned values.
- **Missing env vars**: Copy `.env.example` to `.env` and fill required values.

## Support

For issues, questions, and discussions:
- [Issue Tracker](https://github.com/usequark/quark/issues)
- [Discussions](https://github.com/usequark/quark/discussions)
