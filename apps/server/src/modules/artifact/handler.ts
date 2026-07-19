import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ArtifactService } from "./service.js";
import {
  CreateArtifactSchema,
  CreateArtifactVersionSchema,
  PatchArtifactVersionSchema,
  CreateArtifactFileSchema,
  AttachLineageSchema,
  ListArtifactsQuerySchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";
import { assertOwnsArtifactVersion } from "../../core/authz/assert-workspace.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const ArtifactParamsSchema = z.object({ artifactId: z.string().uuid() });
const VersionParamsSchema = z.object({ versionId: z.string().uuid() });
const LineageParamsSchema = z.object({
  versionId: z.string().uuid(),
  parentVersionId: z.string().uuid(),
});

export class ArtifactHandler {
  constructor(
    private readonly artifactService: ArtifactService,
    private readonly projectService: ProjectService,
  ) {}

  async createArtifact(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const data = CreateArtifactSchema.parse(req.body);
    const artifact = await this.artifactService.createArtifact(projectId, data);
    reply.status(201).send(artifact);
  }

  async listArtifacts(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const artifacts = await this.artifactService.listArtifactsByProject(projectId);
    reply.send({ items: artifacts });
  }

  /**
   * Workspace-wide artifact list. Backed by `GET /artifacts`. Mirrors the
   * pagination shape of `/runs` (`{ items, total }`) so the dashboard's
   * top-level Artifacts / Datasets views share the same wire contract.
   * Always scoped to the requestor's workspace.
   */
  async listAllArtifacts(req: FastifyRequest, reply: FastifyReply) {
    const query = ListArtifactsQuerySchema.parse(req.query);
    const result = await this.artifactService.listArtifacts({
      ...query,
      workspaceId: req.workspaceId,
    });
    reply.send(result);
  }

  async getArtifact(req: FastifyRequest, reply: FastifyReply) {
    const { artifactId } = ArtifactParamsSchema.parse(req.params);
    const artifact = await this.artifactService.findArtifactById(artifactId);
    if (!artifact) {
      reply.status(404).send({ error: "Artifact not found" });
      return;
    }
    reply.send(artifact);
  }

  async createVersion(req: FastifyRequest, reply: FastifyReply) {
    const { artifactId } = ArtifactParamsSchema.parse(req.params);
    const data = CreateArtifactVersionSchema.parse(req.body);
    const version = await this.artifactService.createVersion(artifactId, data);
    reply.status(201).send(version);
  }

  async listVersions(req: FastifyRequest, reply: FastifyReply) {
    const { artifactId } = ArtifactParamsSchema.parse(req.params);
    const versions = await this.artifactService.listVersionsByArtifact(artifactId);
    reply.send({ items: versions });
  }

  async getVersion(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    const version = await this.artifactService.findVersionById(versionId);
    if (!version) {
      reply.status(404).send({ error: "Version not found" });
      return;
    }
    reply.send(version);
  }

  async patchVersion(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    const data = PatchArtifactVersionSchema.parse(req.body);
    const version = await this.artifactService.updateVersion(versionId, data);
    reply.send(version);
  }

  async addFile(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    const data = CreateArtifactFileSchema.parse(req.body);
    try {
      const result = await this.artifactService.addFile(versionId, data);
      reply.status(201).send(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("Version not found")) {
        reply.status(404).send({ error: msg });
        return;
      }
      if (msg.startsWith("File path already registered")) {
        reply.status(409).send({ error: msg });
        return;
      }
      throw err;
    }
  }

  async finalizeVersion(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    try {
      const version = await this.artifactService.finalizeVersion(versionId);
      reply.send(version);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("Version not found")) {
        reply.status(404).send({ error: msg });
        return;
      }
      throw err;
    }
  }

  async attachLineage(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    // The URL-param versionId guard is enforced by the preHandler hook.
    const data = AttachLineageSchema.parse(req.body);
    // Body-derived guard: parentVersionId lives in req.body, so the
    // route config can't cover it. Both endpoints of the lineage edge
    // must live in the caller's workspace.
    if (!(await assertOwnsArtifactVersion(req.server.prisma, req, reply, data.parentVersionId))) return;
    try {
      const row = await this.artifactService.attachLineage(versionId, data.parentVersionId, data.type);
      reply.status(201).send(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        reply.status(404).send({ error: msg });
        return;
      }
      if (msg.includes("cannot be its own parent")) {
        reply.status(400).send({ error: msg });
        return;
      }
      throw err;
    }
  }

  async detachLineage(req: FastifyRequest, reply: FastifyReply) {
    const { versionId, parentVersionId } = LineageParamsSchema.parse(req.params);
    // Both endpoint guards are enforced by the preHandler hook (route
    // declares an array rule covering both params).
    await this.artifactService.detachLineage(versionId, parentVersionId);
    reply.status(204).send();
  }

  async listLineage(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    const lineage = await this.artifactService.listLineage(versionId);
    reply.send(lineage);
  }
}