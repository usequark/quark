FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile --filter ./apps/worker... --filter ./packages/db \
	&& pnpm --filter ./packages/db db:generate \
	&& pnpm --filter ./apps/worker --prod deploy --legacy /app/deploy

# `pnpm deploy --prod` correctly drops `prisma` (a devDependency of
# packages/db), but it keeps the peer subtrees pnpm auto-installed *for* that
# devDependency. `prisma` declares `typescript` as an optional peer, so the
# hoisted store ends up with typescript@7 - the native Go build, which ships
# @typescript/typescript-<platform> (a ~100 MB Go `tsc` with 10 HIGH CVEs).
#
# Nothing at runtime needs it: the worker runs compiled JS and talks to
# Postgres through @prisma/client. Remove the auto-installed peer subtrees from
# the deploy output so the runtime image stays free of dev-only binaries.
RUN rm -rf \
	/app/deploy/node_modules/.pnpm/typescript@* \
	/app/deploy/node_modules/.pnpm/@typescript+typescript-* \
	/app/deploy/node_modules/.pnpm/node_modules/typescript \
	/app/deploy/node_modules/.pnpm/node_modules/@typescript \
	/app/deploy/node_modules/.pnpm/node_modules/.bin/tsc \
	/app/deploy/node_modules/typescript \
	/app/deploy/node_modules/@typescript

# `pnpm deploy` rewrites peer-suffixed directory names (e.g.
# valibot@1.4.2_typescript@7.0.2) and nested `.bin/tsc` shims that link back
# into the removed store, so drop those too.
RUN find /app/deploy/node_modules -type d -name '*_typescript@*' -prune \
		-exec rm -rf {} + \
	&& find /app/deploy/node_modules -path '*/node_modules/.bin/tsc*' -delete

# Fail the build rather than ship silently if a future dependency reintroduces
# a dev-only native binary through the same path.
RUN if find /app/deploy -name 'tsc' -type f 2>/dev/null | grep -q .; then \
		echo 'error: dev-only TypeScript binary leaked into the deploy output' >&2; \
		find /app/deploy -name 'tsc' -type f >&2; \
		exit 1; \
	fi

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime

RUN apk upgrade --no-cache

ENV NODE_ENV=production

WORKDIR /app

RUN rm -rf \
	/usr/local/lib/node_modules/npm \
	/usr/local/bin/npm \
	/usr/local/bin/npx \
	/opt/yarn-v1.22.22 \
	/usr/local/bin/yarn \
	/usr/local/bin/yarnpkg

COPY --from=builder /app/deploy/ ./

CMD ["node", "src/index.js"]