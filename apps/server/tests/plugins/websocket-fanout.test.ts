import { describe, expect, it, beforeEach } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { TEST_CONFIG } from "../helpers/build-app.js";
import { websocketPlugin } from "../../src/plugins/websocket.js";
import { MemoryEventBus } from "../../src/infra/memory/memory-event-bus.js";
import type {
  KnownDomainEvent,
  RunCreatedEvent,
  RunFinishedEvent,
  MetricLoggedEvent,
} from "../../src/core/events/domain-event.js";

/**
 * WebSocket fanout scoping: the websocket plugin must broadcast domain
 * events onto the workspace channel named in the event payload, NOT onto
 * a hardcoded "workspace:default". Without that, multi-workspace tenants
 * would receive each other's events.
 */
describe("websocket fanout (per-workspace channels)", () => {
  let app: FastifyInstance;
  let bus: MemoryEventBus;

  beforeEach(async () => {
    app = fastify({ logger: false });
    app.decorate("config", { ...TEST_CONFIG });
    // Real in-memory event bus — the plugin subscribes to it on register.
    bus = new MemoryEventBus();
    app.decorate("eventBus", bus);
    // The plugin decorates `realtime` itself; no need to pre-decorate.
    await app.register(websocketPlugin);
    await app.ready();
  });

  it("RunCreated event lands on workspace:<payload.workspaceId> channel", async () => {
    const captured: Array<{ channel: string; event: string }> = [];
    app.realtime.broadcast = (channel, event) => {
      captured.push({ channel, event });
    };

    const evt: RunCreatedEvent = {
      type: "RunCreated",
      payload: { runId: "r1", projectId: "p1", workspaceId: "ws-acme" },
      occurredAt: new Date(),
    };
    await bus.publish(evt);

    expect(captured).toContainEqual({
      channel: "project:p1",
      event: "RunCreated",
    });
    expect(captured).toContainEqual({
      channel: "workspace:ws-acme",
      event: "RunCreated",
    });
    expect(captured).not.toContainEqual(
      expect.objectContaining({ channel: "workspace:default" }),
    );
  });

  it("RunFinished event lands on workspace:<payload.workspaceId> channel", async () => {
    const captured: Array<{ channel: string; event: string }> = [];
    app.realtime.broadcast = (channel, event) => {
      captured.push({ channel, event });
    };

    const evt: RunFinishedEvent = {
      type: "RunFinished",
      payload: {
        runId: "r2",
        projectId: "p2",
        workspaceId: "ws-beta",
        status: "finished",
      },
      occurredAt: new Date(),
    };
    await bus.publish(evt);

    expect(captured).toContainEqual({
      channel: "workspace:ws-beta",
      event: "RunFinished",
    });
  });

  it("MetricLogged event payload includes workspaceId and fans out correctly", async () => {
    const captured: Array<{ channel: string; event: string }> = [];
    app.realtime.broadcast = (channel, event) => {
      captured.push({ channel, event });
    };

    const evt: MetricLoggedEvent = {
      type: "MetricLogged",
      payload: {
        runId: "r3",
        projectId: "p3",
        workspaceId: "ws-gamma",
        keys: ["loss"],
        count: 1,
      },
      occurredAt: new Date(),
    };
    await bus.publish(evt);

    expect(captured).toContainEqual({
      channel: "run:r3",
      event: "MetricLogged",
    });
    expect(captured).toContainEqual({
      channel: "workspace:ws-gamma",
      event: "MetricLogged",
    });
  });

  it("falls back to defaultWorkspaceId when the event omits workspaceId", async () => {
    const captured: Array<{ channel: string; event: string }> = [];
    app.realtime.broadcast = (channel, event) => {
      captured.push({ channel, event });
    };

    // Cast through `any` because the test's intent is exactly the
    // defensive fallback path the new code added — a payload that's
    // missing workspaceId should still produce a valid workspace channel
    // (the server default) rather than silently dropping the broadcast.
    const evt = {
      type: "RunCreated",
      payload: { runId: "r4", projectId: "p4" },
      occurredAt: new Date(),
    } as unknown as KnownDomainEvent;
    await bus.publish(evt);

    expect(captured).toContainEqual({
      channel: `workspace:${TEST_CONFIG.defaultWorkspaceId}`,
      event: "RunCreated",
    });
  });
});
