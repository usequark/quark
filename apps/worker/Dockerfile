FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS builder

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile --filter ./apps/worker... --filter ./packages/db \
	&& pnpm --filter ./packages/db db:generate \
	&& pnpm --filter ./apps/worker --prod deploy --legacy /app/deploy

FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runtime

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