import type { FastifyInstance } from "fastify";
import { ArtifactService } from "./service.js";
import { ArtifactHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function artifactRoutes(app: FastifyInstance) {
  const artifactService = new ArtifactService(app.prisma, app.storage);
  const projectService = new ProjectService(app.prisma);
  const handler = new ArtifactHandler(artifactService, projectService);

  app.post("/projects/:projectId/artifacts", handler.createArtifact.bind(handler));
  app.get("/projects/:projectId/artifacts", handler.listArtifacts.bind(handler));
  app.get("/artifacts/:artifactId", handler.getArtifact.bind(handler));
  app.post("/artifacts/:artifactId/versions", handler.createVersion.bind(handler));
  app.get("/artifacts/:artifactId/versions", handler.listVersions.bind(handler));
  app.get("/versions/:versionId", handler.getVersion.bind(handler));
  app.patch("/versions/:versionId", handler.patchVersion.bind(handler));
  app.post("/versions/:versionId/files", handler.addFile.bind(handler));
}
