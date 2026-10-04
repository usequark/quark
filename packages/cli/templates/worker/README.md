# Quark Worker Service

Background job processor using **BullMQ** and **Redis**.

## Quick Start

```bash
docker compose up -d     # Redis required
pnpm install
pnpm dev                 # Starts worker with file watching
```

## Adding a Job Handler

1. Define the job name in `packages/jobs/src/definitions.js`
2. Create a handler in `apps/worker/src/handlers/<job-name>.js`:

```javascript
import { createLogger } from "@usequark/quark-core";

const log = createLogger("job:my-task");

export async function handleMyTask({ data }) {
  log.info("processing", data);
  // your logic here
}
```

3. Register it in `apps/worker/src/handlers/index.js`:

```javascript
import { handleMyTask } from "./my-task.js";

const jobHandlers = {
  [JOB_NAMES.MY_TASK]: handleMyTask,
};
```

## Dispatching Jobs

```javascript
import { createQueue, addJob } from "@usequark/quark-core";
import { JOB_NAMES } from "@yourscope/jobs";

const queue = createQueue("default");
await addJob(queue, JOB_NAMES.MY_TASK, { userId: "123" });
```

## Key Files

| File | Purpose |
|---|---|
| `src/index.js` | Worker entry point, queue registration |
| `src/handlers/` | Job handler functions |
| `src/lib/` | Shared utilities (tokens, Railway helpers) |
| `railway.json` | Railway deployment config *(deprecated - use `.railway/railway.ts`)* |
