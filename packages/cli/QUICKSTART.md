# Quick Start Guide - @quark/create-app

## Installation

```bash
npm install -g @quark/create-app
```

## Creating Your First Project

### Step 1: Generate Project
```bash
npx @quark/create-app my-first-app
```

You'll see:
```
🚀 Creating your new Quark project: my-first-app

  📦 Scaffolding base project structure...
  🎯 Configuring features...

? Which packages would you like to eject (customize) locally?
  ◉ UI Components (packages/ui)
  ◉ Job Definitions (packages/jobs)
  ○ Configuration (packages/config)
```

### Step 2: Choose Packages
Use arrow keys to select/deselect packages, then press Enter:
- **UI Components** - React components (Button, Input, Card)
- **Job Definitions** - Job queue management
- **Configuration** - Centralized app config

### Step 3: Setup Environment
```bash
cd my-first-app
cp .env.example .env
```

The `.env` file contains:
- PostgreSQL credentials
- Redis configuration
- Email service settings (Mailhog)
- API base URL

### Step 4: Install Dependencies
```bash
pnpm install
```

### Step 5: Start Services
```bash
docker compose up -d
```

This starts:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache & Job Queue
- **Mailhog** (port 8025) - Local email testing

### Step 6: Run Development Server
```bash
pnpm dev
```

## What You Get

### Project Structure
```
my-first-app/
├── apps/              # Your applications
├── packages/
│   ├── ui/           # Custom UI components
│   ├── jobs/         # Job definitions
│   └── config/       # App configuration
├── docker-compose.yml # Local services
├── package.json      # Root workspace
└── .git/             # Git repository
```

### Git Ready
Your project is already a git repository with an initial commit:
```bash
cd my-first-app
git log
# commit: Initial commit: Quark project scaffold
git remote add origin <your-repo-url>
git push -u origin main
```

## Using the Generated Packages

### UI Components
```javascript
// File: apps/web/src/MyComponent.js
import { Button, Input, Card } from "@my-first-app/ui";

export function MyComponent() {
  return (
    <Card>
      <h1>Welcome</h1>
      <Input placeholder="Enter name..." />
      <Button variant="primary">Submit</Button>
    </Card>
  );
}
```

### Job Definitions
```javascript
// File: packages/jobs/src/definitions.js
export const JOB_NAMES = {
  SEND_EMAIL: "send-email",
  CLEANUP: "cleanup-data",
};

// File: packages/jobs/src/handlers.js
export async function sendEmail(job) {
  const { to, subject, message } = job.data;
  // Send email via Mailhog
  return { sent: true };
}
```

### Configuration
```javascript
// File: apps/web/src/api.js
import config from "@my-first-app/config";

const apiClient = fetch(config.api.baseUrl);
const dbUrl = config.database.url;
```

## Common Commands

```bash
# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Lint code
pnpm lint

# Run in development mode
pnpm dev

# Stop services
docker compose down

# View database
pnpm db:generate  # Generate Prisma client if using DB
```

## Accessing Services

### Mailhog (Email Testing)
```
http://localhost:8025
```
View all emails sent by your app in development.

### PostgreSQL
```bash
# Using psql
psql -U quark -d my_first_app_dev -h localhost

# Or update .env
DATABASE_URL=postgresql://quark:development@localhost:5432/my_first_app_dev
```

### Redis
```bash
# Using redis-cli
redis-cli -p 6379
# Or use your preferred Redis client
```

## Project Naming and Scopes

Your project name determines package scopes:

| Project Name | UI Package | Jobs Package |
|--------------|-----------|--------------|
| my-app | @my-app/ui | @my-app/jobs |
| awesome-project | @awesome-project/ui | @awesome-project/jobs |
| startup | @startup/ui | @startup/jobs |

This prevents naming conflicts and makes packages easily identifiable.

## Development Workflow

1. **Create project**
   ```bash
   npx @quark/create-app my-app
   ```

2. **Setup environment**
   ```bash
   cd my-app
   cp .env.example .env
   ```

3. **Install packages**
   ```bash
   pnpm install
   ```

4. **Start services**
   ```bash
   docker compose up -d
   ```

5. **Development**
   ```bash
   pnpm dev
   ```

6. **Create git repo**
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5432 (PostgreSQL)
lsof -i :5432

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
POSTGRES_PORT=5433 docker compose up -d
```

### Dependencies Not Installed
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Git Initialization Failed
```bash
cd your-project
git init
git config user.email "you@example.com"
git config user.name "Your Name"
git add .
git commit -m "Initial commit"
```

## Next Steps

### Add Your First App
```bash
mkdir -p apps/web
cd apps/web
npm init
```

### Configure Database
```bash
# Generate Prisma client
pnpm db:generate

# Create migrations
pnpm prisma migrate dev --name init
```

### Deploy
The project is ready for deployment to:
- Vercel (Next.js apps)
- Docker (containerized deployment)
- AWS, Google Cloud, Azure (with docker-compose)

## Learn More

- 📖 [Quark Documentation](https://docs.quark.dev)
- 🔗 [Turbo Monorepo Guide](https://turbo.build/docs)
- 🐘 [pnpm Documentation](https://pnpm.io)
- 🐳 [Docker Compose Reference](https://docs.docker.com/compose/)

## Support

For issues or questions:
- 🐛 [GitHub Issues](https://github.com/quarkproject/quark/issues)
- 💬 [Discussions](https://github.com/quarkproject/quark/discussions)
- 📧 support@quark.dev
