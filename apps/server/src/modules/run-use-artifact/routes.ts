import type { FastifyInstance } from "fastify";
import { RunUseArtifactHandler } from "./handler.js";
import { RunUseArtifactService } from "./service.js";

/**
 * Run-use-artifact module — `POST /api/v1/runs/:id/use-artifact`. Step 3.2
 * replacement for wandb's `UseArtifact` GraphQL mutation. Records that a
 * run referenced an artifact version (input/output/job/etc.).
 */
export async function runUseArtifactRoutes(app: FastifyInstance) {
  const service = new RunUseArtifactService(app.prisma);
  const handler = new RunUseArtifactHandler(service);

  app.post(
    "/runs/:id/use-artifact",
    {
      config: { authz: { kind: "run", param: "id" } },
    },
    handler.create.bind(handler),
  );
}