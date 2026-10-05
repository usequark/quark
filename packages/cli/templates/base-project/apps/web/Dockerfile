FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile \
	&& pnpm db:generate \
	&& pnpm --dir apps/web build:deploy

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime

RUN apk upgrade --no-cache

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