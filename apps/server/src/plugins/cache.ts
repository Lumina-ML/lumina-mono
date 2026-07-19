import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Cache } from "../core/cache/cache.js";
import { NoopCache } from "../infra/noop/noop-cache.js";
import { RedisCache } from "../infra/redis/redis-cache.js";

declare module "fastify" {
  interface FastifyInstance {
    cache: Cache;
  }
}

export const cachePlugin = fp(async (app: FastifyInstance) => {
  const cache: Cache = app.config.redisUrl
    ? new RedisCache({ url: app.config.redisUrl, keyPrefix: "lumina" })
    : new NoopCache();
  app.decorate("cache", cache);

  app.addHook("onClose", async () => {
    if (cache instanceof RedisCache) {
      await cache.close();
    }
  });
});
