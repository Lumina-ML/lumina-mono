import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import fastifyWebsocket from "@fastify/websocket";
import { RealtimeConnectionManager } from "../realtime/connection-manager.js";
import type { KnownDomainEvent } from "../core/events/domain-event.js";

declare module "fastify" {
  interface FastifyInstance {
    realtime: RealtimeConnectionManager;
  }
}

function channelForEvent(event: KnownDomainEvent): string | undefined {
  switch (event.type) {
    case "MetricLogged":
      return `run:${event.payload.runId}`;
    case "RunCreated":
      return `project:${event.payload.projectId}`;
    case "RunFinished":
      return `run:${event.payload.runId}`;
    case "ArtifactUploaded":
      return `project:${event.payload.projectId}`;
    default:
      return undefined;
  }
}

export const websocketPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyWebsocket);

  const realtime = new RealtimeConnectionManager();
  app.decorate("realtime", realtime);

  app.get("/ws", { websocket: true }, (connection, _req) => {
    realtime.addConnection(connection.socket);
  });

  // Subscribe to domain events and broadcast to WebSocket clients.
  // When using RedisEventBus, this also receives events from other instances.
  app.eventBus.subscribe("MetricLogged", (event) => {
    const channel = channelForEvent(event);
    if (channel) {
      realtime.broadcast(channel, event.type, event.payload);
    }
  });

  app.eventBus.subscribe("RunCreated", (event) => {
    const channel = channelForEvent(event);
    if (channel) {
      realtime.broadcast(channel, event.type, event.payload);
    }
  });

  app.eventBus.subscribe("RunFinished", (event) => {
    const channel = channelForEvent(event);
    if (channel) {
      realtime.broadcast(channel, event.type, event.payload);
    }
  });

  app.eventBus.subscribe("ArtifactUploaded", (event) => {
    const channel = channelForEvent(event);
    if (channel) {
      realtime.broadcast(channel, event.type, event.payload);
    }
  });
});
