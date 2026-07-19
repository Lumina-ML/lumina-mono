FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

RUN pnpm --filter @lumina/server db:generate
# Wipe any prior dist so the container only ships the freshly compiled
# output. Without this, stale `dist/index.js` from an earlier build
# (different tsconfig/rootDir) can shadow the new `dist/src/index.js`
# the CMD actually points at.
RUN rm -rf apps/server/dist
RUN pnpm --filter @lumina/server build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
# wget: 供 docker-compose healthcheck 探测 /healthz 使用(node:20-slim 默认不带)。
RUN apt-get update -y && apt-get install -y openssl python3 make g++ wget && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
# tsc emits the build under `dist/src/...` (rootDir: "./" in tsconfig),
# so the generated Prisma client lives next to the compiled code, not
# at the dist root.
COPY --from=builder /app/apps/server/src/generated ./apps/server/dist/src/generated
COPY --from=builder /app/packages/shared ./packages/shared

RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/apps/server

EXPOSE 8000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/index.js"]
