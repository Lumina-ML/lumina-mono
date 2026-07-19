# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/lumina-ui/package.json ./packages/lumina-ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
# 注意:dashboard 的 vite.config.ts 用 alias 把 @lumina/ui 解析到
# packages/lumina-ui/src/index.ts,所以这里只需要把 UI 库的源码拷进来即可,
# 不再需要先 `pnpm --filter @lumina/ui build`(否则会出现 dist 跟源码脱节、
# 改动 UI 库组件但容器里看不到效果的问题)。
COPY apps/dashboard ./apps/dashboard
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY packages/lumina-ui ./packages/lumina-ui

# Build dashboard
RUN pnpm --filter @lumina/dashboard build

# Runtime stage
FROM nginx:alpine

COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
