import type { FastifyInstance } from "fastify";
import { SandboxService } from "./service.js";
import { SandboxHandler } from "./handler.js";

/**
 * Sandbox routes — the "Try it" endpoints that back the dashboard's
 * demo cards (Roadmap §MVP-2 / M1-1).
 *
 * - `POST /sandbox/run-example`  body `{ scenario }`  → writes the
 *   scenario's mock data into the `__demo__` project and returns the
 *   deep-link target.
 * - `POST /sandbox/reset-demo`   body `{ projectId }` → wipes everything
 *   under that project (used by the "Reset demo data" button).
 *
 * Both endpoints require an authenticated user. We don't tie them to a
 * specific project on the URL because the demo project is auto-resolved
 * by name (`__demo__`) inside the active workspace. The route name
 * lives at `/sandbox/...` rather than `/projects/:id/sandbox/...` so
 * it sits naturally alongside other workspace-wide admin tools.
 */
export async function sandboxRoutes(app: FastifyInstance) {
  const service = new SandboxService(app.prisma, app.traceStorage);
  const handler = new SandboxHandler(service);

  app.post("/sandbox/run-example", handler.runExample.bind(handler));
  app.post("/sandbox/reset-demo", handler.resetDemo.bind(handler));
}