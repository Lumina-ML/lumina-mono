import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Cache } from "../core/cache/cache.js";
import { NoopCache } from "../infra/noop/noop-cache.js";

declare module "fastify" {
  interface FastifyInstance {
    cache: Cache;
  }
}

export const cachePlugin = fp(async (app: FastifyInstance) => {
  const cache: Cache = app.config.redisUrl ? new NoopCache() : new NoopCache();
  app.decorate("cache", cache);
});
