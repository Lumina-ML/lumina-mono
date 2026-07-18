import type { FastifyInstance } from "fastify";
import { RegistryModelService } from "./service.js";
import { RegistryModelHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function registryModelRoutes(app: FastifyInstance) {
  const registryModelService = new RegistryModelService(app.prisma, app.storage);
  const projectService = new ProjectService(app.prisma);
  const handler = new RegistryModelHandler(registryModelService, projectService);

  app.post("/projects/:projectId/registry-models", handler.createRegistryModel.bind(handler));
  app.get("/projects/:projectId/registry-models", handler.listRegistryModels.bind(handler));
  app.get("/registry-models/:modelId", handler.getRegistryModel.bind(handler));
  app.post("/registry-models/:modelId/versions", handler.createVersion.bind(handler));
  app.get("/registry-models/:modelId/versions", handler.listVersions.bind(handler));
  app.get("/registry-model-versions/:versionId", handler.getVersion.bind(handler));
  app.patch("/registry-model-versions/:versionId", handler.patchVersion.bind(handler));
}
