import type { FastifyInstance } from "fastify";
import { RegistryModelService } from "./service.js";
import { RegistryModelHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function registryModelRoutes(app: FastifyInstance) {
  const registryModelService = new RegistryModelService(app.prisma, app.storage);
  const projectService = new ProjectService(app.prisma);
  const handler = new RegistryModelHandler(registryModelService, projectService);

  app.post("/projects/:projectId/registry-models", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createRegistryModel.bind(handler));
  app.get("/projects/:projectId/registry-models", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listRegistryModels.bind(handler));
  app.get("/registry-models/:modelId", {
    config: { authz: { kind: "registryModel", param: "modelId" } },
  }, handler.getRegistryModel.bind(handler));
  app.post("/registry-models/:modelId/versions", {
    config: { authz: { kind: "registryModel", param: "modelId" } },
  }, handler.createVersion.bind(handler));
  app.get("/registry-models/:modelId/versions", {
    config: { authz: { kind: "registryModel", param: "modelId" } },
  }, handler.listVersions.bind(handler));
  app.get("/registry-model-versions/:versionId", {
    config: { authz: { kind: "registryModelVersion", param: "versionId" } },
  }, handler.getVersion.bind(handler));
  app.patch("/registry-model-versions/:versionId", {
    config: { authz: { kind: "registryModelVersion", param: "versionId" } },
  }, handler.patchVersion.bind(handler));
}
