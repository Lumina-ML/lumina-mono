import type { FastifyInstance } from "fastify";
import { RunService } from "../run/service.js";
import { RunStopHandler } from "./handler.js";

/**
 * Run-stop module — exposes `GET /api/v1/runs/:id/should-stop` so the
 * rewired SDK sender (`SendManager.send_request_stop_status`) can poll
 * for a stop signal without depending on the wandb GraphQL contract.
 *
 * Stop is signalled by setting `Run.metadata.stopRequested = true` via
 * the existing PATCH /runs/:id route. No additional schema is needed.
 */
export async function runStopRoutes(app: FastifyInstance) {
  const runService = new RunService(
    app.prisma,
    app.eventBus,
    app.config.defaultWorkspaceId,
  );
  const handler = new RunStopHandler(runService);

  app.get(
    "/runs/:id/should-stop",
    {
      config: { authz: { kind: "run", param: "id" } },
    },
    handler.shouldStop.bind(handler),
  );
}