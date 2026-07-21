import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { EventBus } from "../core/bus/event-bus.js";
import { MemoryEventBus } from "../infra/memory/memory-event-bus.js";
import { RedisEventBus } from "../infra/redis/redis-event-bus.js";

declare module "fastify" {
  interface FastifyInstance {
    eventBus: EventBus;
  }
}

export const busPlugin = fp(async (app: FastifyInstance) => {
  const busLogger = app.log.child({ component: "event-bus" });
  const bus: EventBus = app.config.redisUrl
    ? new RedisEventBus({
      redisUrl: app.config.redisUrl,
      channelPrefix: "lumina:events",
      logger: busLogger,
    })
    : new MemoryEventBus(busLogger);
  app.decorate("eventBus", bus);

  app.addHook("onClose", async () => {
    if (bus instanceof RedisEventBus) {
      await bus.close();
    }
  });
});
