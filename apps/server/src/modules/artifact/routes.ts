import type { FastifyInstance } from "fastify";
import { ArtifactService } from "./service.js";
import { ArtifactHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { container } from "../../core/di/container.js";

export async function artifactRoutes(app: FastifyInstance) {
  const artifactService = container.resolve(ArtifactService);
  const projectService = container.resolve(ProjectService);
  const handler = new ArtifactHandler(artifactService, projectService);

  app.post("/projects/:projectId/artifacts", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createArtifact.bind(handler));
  app.get("/projects/:projectId/artifacts", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listArtifacts.bind(handler));
  // Workspace-wide list. Accepts `projectId` / `type` / `limit` / `offset`.
  app.get("/artifacts", handler.listAllArtifacts.bind(handler));
  app.get("/artifacts/:artifactId", {
    config: { authz: { kind: "artifact", param: "artifactId" } },
  }, handler.getArtifact.bind(handler));
  app.post("/artifacts/:artifactId/versions", {
    config: { authz: { kind: "artifact", param: "artifactId" } },
  }, handler.createVersion.bind(handler));
  app.get("/artifacts/:artifactId/versions", {
    config: { authz: { kind: "artifact", param: "artifactId" } },
  }, handler.listVersions.bind(handler));
  app.get("/versions/:versionId", {
    config: { authz: { kind: "artifactVersion", param: "versionId" } },
  }, handler.getVersion.bind(handler));
  app.patch("/versions/:versionId", {
    config: { authz: { kind: "artifactVersion", param: "versionId" } },
  }, handler.patchVersion.bind(handler));
  app.post("/versions/:versionId/files", {
    config: { authz: { kind: "artifactVersion", param: "versionId" } },
  }, handler.addFile.bind(handler));
  app.post("/versions/:versionId/finalize", {
    config: { authz: { kind: "artifactVersion", param: "versionId" } },
  }, handler.finalizeVersion.bind(handler));

  app.post("/versions/:versionId/lineage", {
    // The parentVersionId lives in req.body, so the route config can
    // only cover the URL param. The body-derived guard stays inline
    // inside `attachLineage` (see handler.ts).
    config: { authz: { kind: "artifactVersion", param: "versionId" } },
  }, handler.attachLineage.bind(handler));
  app.delete(
    "/versions/:versionId/lineage/:parentVersionId",
    {
      // Both endpoints of the lineage edge must live in the caller's
      // workspace; declare both in the rule array.
      config: {
        authz: [
          { kind: "artifactVersion", param: "versionId" },
          { kind: "artifactVersion", param: "parentVersionId" },
        ],
      },
    },
    handler.detachLineage.bind(handler),
  );
  app.get("/versions/:versionId/lineage", {
    config: { authz: { kind: "artifactVersion", param: "versionId" } },
  }, handler.listLineage.bind(handler));
}