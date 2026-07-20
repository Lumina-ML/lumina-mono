import type { FastifyReply, FastifyRequest } from "fastify";
import { RecordUseArtifactSchema } from "./schema.js";
import { RunUseArtifactService } from "./service.js";

export class RunUseArtifactHandler {
  constructor(private readonly service: RunUseArtifactService) {}

  async create(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = RecordUseArtifactSchema.parse(req.body);
    const row = await this.service.create(req.params.id, data);
    reply.status(201).send({
      runId: row.runId,
      useArtifactId: row.id,
      artifactVersionId: row.artifactVersionId,
      createdAt: row.createdAt.toISOString(),
    });
  }
}