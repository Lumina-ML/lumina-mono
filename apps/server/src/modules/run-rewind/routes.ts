import type { FastifyInstance } from "fastify";
import { RunRewindHandler } from "./handler.js";
import { RunRewindService } from "./service.js";
import { RewindRunSchema } from "./schema.js";

/**
 * Run-rewind module — `POST /api/v1/runs/:id/rewind`. Step 3.2
 * replacement for wandb's `RewindRun` GraphQL mutation. Truncates a
 * run's history at the step where a chosen metric last crossed a given
 * value, so a subsequent `lumina.init(resume="allow")` continues from
 * there.
 */
export async function runRewindRoutes(app: FastifyInstance) {
  const service = new RunRewindService(app.prisma);
  const handler = new RunRewindHandler(service);

  app.post(
    "/runs/:id/rewind",
    {
      config: { authz: { kind: "run", param: "id" } },
    },
    handler.rewind.bind(handler),
  );
}

export { RewindRunSchema };