import { defineRailway, postgres, preserve, project, redis, service } from "railway/iac";

export default defineRailway(() => {
	const web = service("web", {
		build: "pnpm install --frozen-lockfile && pnpm db:generate && pnpm --dir apps/web build:deploy",
		start: "HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy",
		preDeploy: "pnpm db:migrate:deploy",
		healthcheck: "/api/health",
		healthcheckTimeout: 120,
		env: {
			DATABASE_URL: "${{Postgres.DATABASE_URL}}",
			REDIS_URL: "${{Redis.REDIS_URL}}",
			NODE_ENV: "production",
			AUTH_SECRET: preserve(),
			NEXTAUTH_SECRET: preserve(),
			STORAGE_PROVIDER: "local",
			AUTH_ALLOW_SIGNUP: "false",
			HOSTNAME: "0.0.0.0",
		},
	});

	const worker = service("worker", {
		build: "pnpm install --frozen-lockfile && pnpm db:generate",
		start: "pnpm --dir apps/worker start:deploy",
		preDeploy: "pnpm db:migrate:deploy",
		env: {
			DATABASE_URL: "${{Postgres.DATABASE_URL}}",
			REDIS_URL: "${{Redis.REDIS_URL}}",
			NODE_ENV: "production",
			AUTH_SECRET: preserve(),
			NEXTAUTH_SECRET: preserve(),
			STORAGE_PROVIDER: "local",
			WORKER_CONCURRENCY: "5",
		},
	});

	const PostgresDb = postgres("Postgres");
	const RedisDb = redis("Redis");

	return project("__QUARK_PROJECT_NAME__", {
		resources: [web, worker, PostgresDb, RedisDb],
	});
});
