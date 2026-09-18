FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

# ── Build shared ──
FROM deps AS build-shared
COPY packages/shared/ packages/shared/
RUN --mount=type=cache,target=/root/.pnpm-store pnpm --filter @zainpreneur/shared build

# ── Build server ──
FROM build-shared AS build-server
COPY packages/server/ packages/server/
RUN pnpm --filter @zainpreneur/server build

# ── Build web ──
FROM build-shared AS build-web
COPY packages/web/ packages/web/
RUN pnpm --filter @zainpreneur/web build

# ── Production server ──
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=build-server /app/packages/server/dist packages/server/dist
COPY --from=build-server /app/packages/server/package.json packages/server/
COPY --from=build-server /app/packages/server/node_modules packages/server/node_modules
COPY --from=build-server /app/packages/server/prisma packages/server/prisma
COPY --from=build-shared /app/packages/shared/dist packages/shared/dist
COPY --from=build-shared /app/packages/shared/package.json packages/shared/
COPY package.json pnpm-workspace.yaml ./

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/server/dist/index.js"]
