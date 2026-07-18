import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { RegistryModelService } from "./service.js";
import {
  CreateRegistryModelSchema,
  CreateRegistryModelVersionSchema,
  PatchRegistryModelVersionSchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const ModelParamsSchema = z.object({ modelId: z.string().uuid() });
const VersionParamsSchema = z.object({ versionId: z.string().uuid() });

export class RegistryModelHandler {
  constructor(
    private readonly registryModelService: RegistryModelService,
    private readonly projectService: ProjectService,
  ) {}

  async createRegistryModel(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const data = CreateRegistryModelSchema.parse(req.body);
    const project = await this.projectService.findById(projectId);
    if (!project) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }
    const model = await this.registryModelService.createRegistryModel(projectId, data);
    reply.status(201).send(model);
  }

  async listRegistryModels(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const models = await this.registryModelService.listByProject(projectId);
    reply.send({ items: models });
  }

  async getRegistryModel(req: FastifyRequest, reply: FastifyReply) {
    const { modelId } = ModelParamsSchema.parse(req.params);
    const model = await this.registryModelService.findById(modelId);
    if (!model) {
      reply.status(404).send({ error: "Registry model not found" });
      return;
    }
    reply.send(model);
  }

  async createVersion(req: FastifyRequest, reply: FastifyReply) {
    const { modelId } = ModelParamsSchema.parse(req.params);
    const data = CreateRegistryModelVersionSchema.parse(req.body);
    const version = await this.registryModelService.createVersion(modelId, data);
    reply.status(201).send(version);
  }

  async listVersions(req: FastifyRequest, reply: FastifyReply) {
    const { modelId } = ModelParamsSchema.parse(req.params);
    const versions = await this.registryModelService.listVersionsByModel(modelId);
    reply.send({ items: versions });
  }

  async getVersion(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    const version = await this.registryModelService.findVersionById(versionId);
    if (!version) {
      reply.status(404).send({ error: "Registry model version not found" });
      return;
    }
    reply.send(version);
  }

  async patchVersion(req: FastifyRequest, reply: FastifyReply) {
    const { versionId } = VersionParamsSchema.parse(req.params);
    const data = PatchRegistryModelVersionSchema.parse(req.body);
    const version = await this.registryModelService.updateVersion(versionId, data);
    reply.send(version);
  }
}
