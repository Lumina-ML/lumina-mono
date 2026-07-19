import type { FastifyReply, FastifyRequest } from "fastify";
import { RunFileService } from "./service.js";
import { SaveFileBodySchema, GetFileQuerySchema } from "./schema.js";
import { RunService } from "../run/service.js";

export class RunFileHandler {
  constructor(
    private readonly fileService: RunFileService,
    private readonly runService: RunService,
  ) {}

  async save(
    req: FastifyRequest<{ Params: { runId: string } }>,
    reply: FastifyReply,
  ) {
    const data = SaveFileBodySchema.parse(req.body);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    const result = await this.fileService.save(req.params.runId, data);
    reply.status(201).send(result);
  }

  async list(
    req: FastifyRequest<{ Params: { runId: string } }>,
    reply: FastifyReply,
  ) {
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    const files = await this.fileService.list(req.params.runId);
    reply.send({ runId: req.params.runId, files });
  }

  async get(
    req: FastifyRequest<{ Params: { runId: string }; Querystring: { path?: string } }>,
    reply: FastifyReply,
  ) {
    const query = GetFileQuerySchema.parse(req.query);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    const result = await this.fileService.get(req.params.runId, query.path);
    if (!result) {
      reply.status(404).send({ error: "File not found" });
      return;
    }
    reply.send({ runId: req.params.runId, path: query.path, ...result });
  }
}