import type { FastifyInstance } from "fastify";
import { RunResumeHandler } from "./handler.js";
import { RunResumeService } from "./service.js";

/**
 * Run-resume module — `GET /api/v1/runs/:id/resume-state`. Step 3.2
 * replacement for wandb's `Api.run_resume_status` GraphQL query.
 *
 * Returns the tail data (last N history rows, last N events, log-line
 * count) plus the run's config / summary / tags so a resumed training
 * job can pick up where the previous one left off.
 */
export async function runResumeRoutes(app: FastifyInstance) {
  const service = new RunResumeService(app.prisma);
  const handler = new RunResumeHandler(service);

  app.get(
    "/runs/:id/resume-state",
    {
      config: { authz: { kind: "run", param: "id" } },
    },
    handler.get.bind(handler),
  );
}