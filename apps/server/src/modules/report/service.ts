import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateReportInput,
  PatchReportInput,
  ListReportsQuery,
} from "./schema.js";
import { ReportRepository } from "./repository.js";

export class ReportService {
  private readonly repository: ReportRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new ReportRepository(prisma);
  }

  async createReport(projectId: string, data: CreateReportInput) {
    return this.repository.createReport(projectId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async list(params: ListReportsQuery & { workspaceId?: string }) {
    return this.repository.list(params);
  }

  async updateReport(id: string, data: PatchReportInput) {
    return this.repository.updateReport(id, data);
  }

  async deleteReport(id: string) {
    return this.repository.deleteReport(id);
  }
}
