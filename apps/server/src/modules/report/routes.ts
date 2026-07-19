import type { FastifyInstance } from "fastify";
import { ReportService } from "./service.js";
import { ReportHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function reportRoutes(app: FastifyInstance) {
  const reportService = new ReportService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const handler = new ReportHandler(reportService, projectService);

  app.post("/projects/:projectId/reports", handler.createReport.bind(handler));
  app.get("/projects/:projectId/reports", handler.listReports.bind(handler));
  // Workspace-wide list. Accepts `projectId` / `limit` / `offset`.
  app.get("/reports", handler.listAllReports.bind(handler));
  app.get("/reports/:reportId", handler.getReport.bind(handler));
  app.patch("/reports/:reportId", handler.patchReport.bind(handler));
  app.delete("/reports/:reportId", handler.deleteReport.bind(handler));
}
