import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ReportService } from "./service.js";
import {
  CreateReportSchema,
  PatchReportSchema,
  ListReportsQuerySchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const ReportParamsSchema = z.object({ reportId: z.string().uuid() });

export class ReportHandler {
  constructor(
    private readonly reportService: ReportService,
    private readonly projectService: ProjectService,
  ) {}

  async createReport(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const data = CreateReportSchema.parse(req.body);
    const project = await this.projectService.findById(projectId);
    if (!project) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }
    const report = await this.reportService.createReport(projectId, data);
    reply.status(201).send(report);
  }

  async listReports(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const reports = await this.reportService.listByProject(projectId);
    reply.send({ items: reports });
  }

  /**
   * Workspace-wide report list. Backed by `GET /reports`. Same wire shape as
   * `/runs` (`{ items, total }`) so the dashboard's top-level Reports view
   * can paginate without extra plumbing.
   */
  async listAllReports(req: FastifyRequest, reply: FastifyReply) {
    const query = ListReportsQuerySchema.parse(req.query);
    const result = await this.reportService.list(query);
    reply.send(result);
  }

  async getReport(req: FastifyRequest, reply: FastifyReply) {
    const { reportId } = ReportParamsSchema.parse(req.params);
    const report = await this.reportService.findById(reportId);
    if (!report) {
      reply.status(404).send({ error: "Report not found" });
      return;
    }
    reply.send(report);
  }

  async patchReport(req: FastifyRequest, reply: FastifyReply) {
    const { reportId } = ReportParamsSchema.parse(req.params);
    const data = PatchReportSchema.parse(req.body);
    const report = await this.reportService.updateReport(reportId, data);
    reply.send(report);
  }

  async deleteReport(req: FastifyRequest, reply: FastifyReply) {
    const { reportId } = ReportParamsSchema.parse(req.params);
    await this.reportService.deleteReport(reportId);
    reply.status(204).send();
  }
}
