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

function channelsForEvent(
  event: KnownDomainEvent,
  defaultWorkspaceId: string,
): string[] {
  const out: string[] = [];
  switch (event.type) {
    case "MetricLogged":
      // Per-run only. MetricLogged fires very frequently and fanning
      // out to project would scale poorly with active runs.
      out.push(`run:${event.payload.runId}`);
      break;
    case "RunCreated":
      out.push(`project:${event.payload.projectId}`);
      break;
    case "RunFinished":
      // Both per-run and per-project: the run page needs to flip status,
      // and the project list needs to update its counters.
      out.push(`run:${event.payload.runId}`);
      out.push(`project:${event.payload.projectId}`);
      break;
    case "ArtifactUploaded":
      out.push(`project:${event.payload.projectId}`);
      break;
  }
  // Workspace-wide channel so cross-page UI (notifications, sidebar
  // counters) gets a single subscription per browser session instead
  // of having to subscribe to every project. Uses the event's own
  // workspaceId so the same broadcast doesn't leak into other
  // workspaces' sessions. Falls back to the server default when the
  // event payload omits it (shouldn't happen post A4, but keeps the
  // plugin from silently dropping the channel).
  const wsId = event.payload.workspaceId || defaultWorkspaceId;
  if (wsId) out.push(`workspace:${wsId}`);
  return out;
}

export const websocketPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyWebsocket);

  const realtime = new RealtimeConnectionManager();
  app.decorate("realtime", realtime);

  const defaultWorkspaceId = app.config.defaultWorkspaceId;

  app.get("/ws", { websocket: true }, (connection, _req) => {
    realtime.addConnection(connection.socket);
  });

  // Subscribe to domain events and broadcast to WebSocket clients.
  // When using RedisEventBus, this also receives events from other instances.
  function fanout(event: KnownDomainEvent) {
    for (const channel of channelsForEvent(event, defaultWorkspaceId)) {
      realtime.broadcast(channel, event.type, event.payload);
    }
  }

  app.eventBus.subscribe("MetricLogged", fanout);
  app.eventBus.subscribe("RunCreated", fanout);
  app.eventBus.subscribe("RunFinished", fanout);
  app.eventBus.subscribe("ArtifactUploaded", fanout);
});
