import type { FastifyReply, FastifyRequest } from "fastify";
import { RunService } from "../run/service.js";

/**
 * Handler for `GET /api/v1/runs/:id/should-stop`.
 *
 * Reads the existing `Run.metadata.stopRequested` flag (set via the
 * standard PATCH /runs/:id route). Keeping it inside the JSON `metadata`
 * envelope means the dashboard can flip the flag from anywhere without
 * adding a dedicated column.
 */
export class RunStopHandler {
  constructor(private readonly runService: RunService) {}

  async shouldStop(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const run = await this.runService.getByRunId(req.params.id);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    // `metadata` defaults to `{}`; treat any truthy value as a stop request.
    const stopRequested = (run.metadata as Record<string, unknown>)
      ?.stopRequested;
    reply.send({ shouldStop: stopRequested === true });
  }
}