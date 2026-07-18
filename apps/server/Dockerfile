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
RUN pnpm --filter @lumina/server build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/src/generated ./apps/server/dist/generated
COPY --from=builder /app/packages/shared ./packages/shared

RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/apps/server

EXPOSE 8000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
