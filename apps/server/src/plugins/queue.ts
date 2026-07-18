import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Queue } from "../core/queue/queue.js";
import { NoopQueue } from "../infra/noop/noop-queue.js";
import { BullMQQueue } from "../infra/bullmq/bullmq-queue.js";

declare module "fastify" {
  interface FastifyInstance {
    queue: Queue;
  }
}

export const queuePlugin = fp(async (app: FastifyInstance) => {
  const queue: Queue = app.config.redisUrl
    ? new BullMQQueue({ redisUrl: app.config.redisUrl })
    : new NoopQueue();
  app.decorate("queue", queue);

  app.addHook("onClose", async () => {
    if (queue instanceof BullMQQueue) {
      await queue.close();
    }
  });
});
