FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile \
	&& pnpm db:generate \
	&& pnpm --dir apps/web build:deploy

FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN rm -rf \
	/usr/local/lib/node_modules/npm \
	/usr/local/bin/npm \
	/usr/local/bin/npx \
	/opt/yarn-v1.22.22 \
	/usr/local/bin/yarn \
	/usr/local/bin/yarnpkg

COPY --from=builder /app/apps/web/.next/standalone/apps/web/ ./

EXPOSE 3000

CMD ["node", "server.js"]