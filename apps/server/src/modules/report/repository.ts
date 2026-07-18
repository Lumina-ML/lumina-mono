import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateReportInput, PatchReportInput } from "./schema.js";

export class ReportRepository {
  constructor(private readonly prisma: PrismaClient) { }

  async createReport(projectId: string, data: CreateReportInput) {
    return this.prisma.report.create({
      data: {
        projectId,
        title: data.title,
        blocks: data.blocks as unknown[] as Record<string, any>,
        createdBy: data.createdBy,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.report.findUnique({
      where: { id },
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.report.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateReport(id: string, data: PatchReportInput) {
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.blocks !== undefined) updateData.blocks = data.blocks as unknown[];
    if (data.createdBy !== undefined) updateData.createdBy = data.createdBy;

    return this.prisma.report.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteReport(id: string) {
    return this.prisma.report.delete({
      where: { id },
    });
  }
}
