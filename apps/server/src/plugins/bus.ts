import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { EventBus } from "../core/bus/event-bus.js";
import { MemoryEventBus } from "../infra/memory/memory-event-bus.js";

declare module "fastify" {
  interface FastifyInstance {
    eventBus: EventBus;
  }
}

export const busPlugin = fp(async (app: FastifyInstance) => {
  const bus = new MemoryEventBus();
  app.decorate("eventBus", bus);
});
