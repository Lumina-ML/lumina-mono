import type { FastifyInstance } from "fastify";
import { ReportService } from "./service.js";
import { ReportHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { container } from "../../core/di/container.js";

export async function reportRoutes(app: FastifyInstance) {
  const reportService = container.resolve(ReportService);
  const projectService = container.resolve(ProjectService);
  const handler = new ReportHandler(reportService, projectService);

  app.post("/projects/:projectId/reports", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createReport.bind(handler));
  app.get("/projects/:projectId/reports", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listReports.bind(handler));
  // Workspace-wide list. Accepts `projectId` / `limit` / `offset`.
  app.get("/reports", handler.listAllReports.bind(handler));
  app.get("/reports/:reportId", {
    config: { authz: { kind: "report", param: "reportId" } },
  }, handler.getReport.bind(handler));
  app.patch("/reports/:reportId", {
    config: { authz: { kind: "report", param: "reportId" } },
  }, handler.patchReport.bind(handler));
  app.delete("/reports/:reportId", {
    config: { authz: { kind: "report", param: "reportId" } },
  }, handler.deleteReport.bind(handler));
}
