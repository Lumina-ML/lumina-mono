import type { FastifyInstance } from "fastify";
import { RunAlertHandler } from "./handler.js";
import { RunAlertService } from "./service.js";

/**
 * Run-alert module — `POST /api/v1/runs/:id/alerts` for the rewired SDK
 * sender's `SendManager.send_alert`. Step 3.2 replacement for wandb's
 * `notify_scriptable_run_alert` GraphQL mutation.
 */
export async function runAlertRoutes(app: FastifyInstance) {
  const service = new RunAlertService(app.prisma);
  const handler = new RunAlertHandler(service);

  app.post(
    "/runs/:id/alerts",
    {
      config: { authz: { kind: "run", param: "id" } },
    },
    handler.create.bind(handler),
  );
}