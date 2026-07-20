import type { FastifyReply, FastifyRequest } from "fastify";
import { LinkArtifactSchema } from "./schema.js";
import { ArtifactLinkService } from "./service.js";

export class ArtifactLinkHandler {
  constructor(private readonly service: ArtifactLinkService) {}

  async link(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = LinkArtifactSchema.parse(req.body);
    const row = await this.service.link(req.params.id, data);
    reply.status(201).send({
      linkId: row.id,
      artifactVersionId: row.artifactVersionId,
      portfolioName: row.portfolioName,
      portfolioProject: row.portfolioProject,
      aliases: row.aliases,
      versionIndex: row.versionIndex,
      createdAt: row.createdAt.toISOString(),
    });
  }
}