import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Queue } from "../core/queue/queue.js";
import { NoopQueue } from "../infra/noop/noop-queue.js";

declare module "fastify" {
  interface FastifyInstance {
    queue: Queue;
  }
}

export const queuePlugin = fp(async (app: FastifyInstance) => {
  const queue: Queue = app.config.redisUrl ? new NoopQueue() : new NoopQueue();
  app.decorate("queue", queue);
});
