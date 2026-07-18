import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ArtifactService } from "./service.js";
import {
  CreateArtifactSchema,
  CreateArtifactVersionSchema,
  PatchArtifactVersionSchema,
  CreateArtifactFileSchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const ArtifactParamsSchema = z.object({ artifactId: z.string().uuid() });
const VersionParamsSchema = z.object({ versionId: z.string().uuid() });

export class ArtifactHandler {
  constructor(
    private readonly artifactService: ArtifactService,
    private readonly projectService: ProjectService,
  ) {}

  async createArtifact(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const data = CreateArtifactSchema.parse(req.body);
    const project = await this.projectService.findById(projectId);
    if (!project) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }
    const artifact = await this.artifactService.createArtifact(projectId, data);
    reply.status(201).send(artifact);
  }

  async listArtifacts(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const artifacts = await this.artifactService.listArtifactsByProject(projectId);
    reply.send({ items: artifacts });
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
    const result = await this.artifactService.addFile(versionId, data);
    reply.status(201).send(result);
  }
}
