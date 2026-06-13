FROM node:22-alpine@sha256:9385cd9f3001dfc3431e8ead12c43e9e1f87cc1b9b5c6cfd0f73865d405b27c4 AS builder

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile --filter ./apps/worker... --filter ./packages/db \
	&& pnpm --filter ./packages/db db:generate \
	&& pnpm --filter ./apps/worker --prod deploy --legacy /app/deploy

FROM node:22-alpine@sha256:9385cd9f3001dfc3431e8ead12c43e9e1f87cc1b9b5c6cfd0f73865d405b27c4 AS runtime

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