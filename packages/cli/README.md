# @quark/create-app CLI

A command-line tool to scaffold new Quark projects with customizable package selection and full git integration.

## Features

✨ **Quick Project Setup**
- Scaffold a new Quark project in seconds
- Pre-configured Turbo monorepo structure
- Docker Compose for local development (PostgreSQL, Redis, Mailhog)

🎯 **Interactive Feature Selection**
- Choose which packages to eject locally
- Select UI components, job definitions, or configuration
- Auto-generate proper package scopes

📦 **Template System**
- Base project with all workspace configuration
- Pre-built templates for UI, Jobs, and Config
- Easily extensible for custom packages

🔧 **Developer-Friendly**
- Automatic git initialization with initial commit
- .env.example file for configuration
- Full npm workspace setup

## Usage

### Create a New Project (Recommended)

From the **Quark repo root**:

```bash
pnpm new my-awesome-app
```

This will prompt you to select optional packages and scaffold your project.

### Alternative: Global Install

For development without the Quark repo:

```bash
# Install globally from this package
pnpm add -g ./packages/cli  # from Quark repo root

# Then from anywhere
quark-create-app my-app
```

This will prompt you to select which packages to include:

```
🚀 Creating your new Quark project: my-awesome-app

  📦 Scaffolding base project structure...
  🎯 Configuring features...

? Which packages would you like to eject (customize) locally?
  ◉ UI Components (packages/ui)
  ◉ Job Definitions (packages/jobs)
  ○ Configuration (packages/config)
```

### Next Steps

After creating your project:

```bash
cd my-awesome-app
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

## Project Structure

The CLI creates the following structure:

```
my-awesome-app/
├── apps/                      # Application workspaces
│   └── web/                   # (Add your apps here)
├── packages/
│   ├── ui/                    # UI components (ejected)
│   │   ├── src/
│   │   │   ├── button.js
│   │   │   ├── input.js
│   │   │   ├── card.js
│   │   │   └── index.js
│   │   └── package.json
│   ├── jobs/                  # Job definitions (ejected)
│   │   ├── src/
│   │   │   ├── definitions.js (job queue and name constants)
│   │   │   ├── handlers.js    (job handlers)
│   │   │   └── index.js
│   │   └── package.json
│   └── config/                # Configuration (optional)
│       ├── src/
│       │   └── index.js
│       └── package.json
├── docker-compose.yml         # Local services (PostgreSQL, Redis, Mailhog)
├── pnpm-workspace.yaml        # pnpm workspace configuration
├── turbo.json                 # Turbo monorepo configuration
├── package.json               # Root package configuration
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── README.md                  # Project README
└── .git/                      # Git repository (initialized)
```

## Included Services (docker-compose.yml)

### PostgreSQL
- Default port: 5432
- Environment variables for configuration

### Redis
- Default port: 6379
- Data persistence with AOF

### Mailhog
- SMTP port: 1025
- Web UI port: 8025
- Useful for local email testing

## Template Details

### Base Project
Contains the foundational configuration:
- `package.json` - Root workspace configuration
- `turbo.json` - Turbo build system settings
- `pnpm-workspace.yaml` - pnpm workspace setup
- `docker-compose.yml` - Local development services
- `.gitignore` - Git ignore patterns
- `README.md` - Project documentation

### UI Package (Optional Eject)
Pre-configured React UI component library:

```javascript
import { Button, Input, Card } from "@myapp/ui";

// Components support variant and className props
<Button variant="primary">Click me</Button>
<Input type="email" />
<Card className="p-4">Content</Card>
```

Components included:
- **Button** - Primary and secondary variants
- **Input** - Styled form input
- **Card** - Container component

### Jobs Package (Optional Eject)
Job queue management with handlers:

```javascript
import { JOB_QUEUES, JOB_NAMES, jobHandlers } from "@myapp/jobs";

// Define jobs
export const JOB_NAMES = {
  SEND_WELCOME_EMAIL: "send-welcome-email",
  SEND_RESET_PASSWORD_EMAIL: "send-reset-password-email",
};

// Handle jobs
export async function sendWelcomeEmail(job) {
  const { email, name } = job.data;
  // Send email...
}
```

### Config Package (Optional Eject)
Centralized configuration management:

```javascript
import config from "@myapp/config";

config.appName        // "My Quark App"
config.database.url   // Database connection string
config.redis.url      // Redis connection string
config.email.from     // Sender email address
```

## Environment Variables

The CLI generates a `.env.example` file with common variables:

```env
# Database
POSTGRES_USER=quark
POSTGRES_PASSWORD=development
POSTGRES_DB=my_awesome_app_dev
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Email
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# Application
NODE_ENV=development
API_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://quark:development@localhost:5432/my_awesome_app_dev
REDIS_URL=redis://localhost:6379
EMAIL_FROM=noreply@myapp.com
```

## Package Scoping

The CLI automatically scopes packages based on your project name:

```
Project: my-awesome-app
├── @my-awesome-app/ui
├── @my-awesome-app/jobs
└── @my-awesome-app/config
```

This prevents naming conflicts and makes your packages easily identifiable.

## Git Integration

The CLI automatically:
1. Initializes a git repository
2. Creates an initial commit with message: "Initial commit: Quark project scaffold"
3. Sets up basic git configuration

You can immediately start working with git:

```bash
cd my-awesome-app
git log                    # View the initial commit
git add .                  # Stage changes
git commit -m "Add features"  # Make more commits
git push origin main       # Push to remote
```

## Turbo Monorepo

The generated project is configured with Turbo for efficient builds:

```bash
pnpm build     # Build all packages
pnpm lint      # Lint all packages
pnpm test      # Test all packages
pnpm dev       # Run dev servers for all packages
```

## Customization

### Adding More Packages

After scaffolding, add new packages manually:

```bash
cd packages
mkdir my-custom-package
cd my-custom-package
npm init
```

Update `pnpm-workspace.yaml` if needed.

### Modifying Templates

The CLI uses templates from `packages/cli/templates/`. To customize:

1. Edit template files in `packages/cli/templates/{ui,jobs,config,base-project}`
2. Re-run the CLI to generate new projects with your customizations

## Testing

Run the CLI tests:

```bash
# Unit tests
pnpm --filter @quark/create-app test-cli

# Integration test
pnpm --filter @quark/create-app test-integration

# End-to-end simulation
pnpm --filter @quark/create-app test-e2e
```

## Troubleshooting

### Command not found
Make sure the package is installed globally:
```bash
npm install -g @quark/create-app
```

### Port conflicts
If services fail to start:
1. Check for running services: `lsof -i :5432` (for PostgreSQL)
2. Modify ports in `docker-compose.yml`
3. Update `.env` file accordingly

### Git errors
If git initialization fails:
```bash
cd your-project
git init
git config user.email "you@example.com"
git config user.name "Your Name"
git add .
git commit -m "Initial commit"
```

## Contributing

To contribute templates or features:

1. Add new templates to `packages/cli/templates/`
2. Update the CLI prompt in `packages/cli/src/index.js`
3. Add tests in `packages/cli/test-*.js`
4. Submit a pull request

## License

ISC

## Support

For issues and questions:
- 📖 [Documentation](https://docs.quark.dev)
- 🐛 [Issue Tracker](https://github.com/quarkproject/quark/issues)
- 💬 [Discussions](https://github.com/quarkproject/quark/discussions)
