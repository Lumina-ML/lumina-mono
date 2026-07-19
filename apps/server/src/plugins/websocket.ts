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

// Mirror DEFAULT_WORKSPACE_ID in bootstrap.ts. Keep them in sync —
// when multi-workspace lands we'll resolve this through the bootstrap
// seed and pass it down explicitly.
const DEFAULT_WORKSPACE_ID = "default";

function channelsForEvent(event: KnownDomainEvent): string[] {
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
  // of having to subscribe to every project. The dashboard hardcodes
  // this id; keep it in sync with `useWorkspaceStore.currentId`.
  out.push(`workspace:${DEFAULT_WORKSPACE_ID}`);
  return out;
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
  function fanout(event: KnownDomainEvent) {
    for (const channel of channelsForEvent(event)) {
      realtime.broadcast(channel, event.type, event.payload);
    }
  }

  app.eventBus.subscribe("MetricLogged", fanout);
  app.eventBus.subscribe("RunCreated", fanout);
  app.eventBus.subscribe("RunFinished", fanout);
  app.eventBus.subscribe("ArtifactUploaded", fanout);
});
