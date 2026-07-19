import type { FastifyReply, FastifyRequest } from "fastify";
import { SandboxService } from "./service.js";
import { RunExampleSchema, ResetDemoSchema } from "./schema.js";

/**
 * Sandbox HTTP handlers. Lives in front of `SandboxService` to:
 *   - validate the body with Zod (rejects unknown scenarios early),
 *   - attach the active workspace id from the request context,
 *   - shape the response for the dashboard (raw `DemoRunResult`).
 *
 * The handlers are intentionally small — the heavy lifting (writing
 * runs / sweeps / evals / traces / artifacts) is in `runners.ts`.
 */
export class SandboxHandler {
  constructor(private readonly service: SandboxService) {}

  async runExample(req: FastifyRequest, reply: FastifyReply) {
    const parsed = RunExampleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    }
    const workspaceId = (req as unknown as { workspaceId: string }).workspaceId;
    try {
      const result = await this.service.runExample(workspaceId, parsed.data.scenario);
      return reply.code(200).send(result);
    } catch (err) {
      req.log.error({ err, scenario: parsed.data.scenario }, "demo scenario failed");
      return reply.code(500).send({ error: "demo_failed", message: (err as Error).message });
    }
  }

  async resetDemo(req: FastifyRequest, reply: FastifyReply) {
    const parsed = ResetDemoSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    }
    const workspaceId = (req as unknown as { workspaceId: string }).workspaceId;
    try {
      const result = await this.service.resetDemo(workspaceId, parsed.data.projectId);
      return reply.code(200).send(result);
    } catch (err) {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ error: "reset_failed", message: (err as Error).message });
    }
  }
}