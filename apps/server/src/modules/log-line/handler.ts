import type { FastifyReply, FastifyRequest } from "fastify";
import { LogLineService } from "./service.js";
import {
  ListLogLinesQuerySchema,
  LogLinesSchema,
  type ListLogLinesQuery,
} from "./schema.js";
import { RunService } from "../run/service.js";

export class LogLineHandler {
  constructor(
    private readonly logLineService: LogLineService,
    private readonly runService: RunService,
  ) {}

  async log(
    req: FastifyRequest<{ Params: { runId: string } }>,
    reply: FastifyReply,
  ) {
    const data = LogLinesSchema.parse(req.body);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    await this.logLineService.log(run.runId, run.projectId, data);
    reply.status(201).send({ success: true });
  }

  async list(
    req: FastifyRequest<{ Params: { runId: string }; Querystring: ListLogLinesQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListLogLinesQuerySchema.parse(req.query);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    const result = await this.logLineService.list(run.runId, {
      level: query.level,
      limit: query.limit,
    });
    reply.send(result);
  }
}
