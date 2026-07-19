import type { PrismaClient, Prisma } from "../../generated/prisma/index.js";
import type {
  CreateReportInput,
  PatchReportInput,
  ListReportsQuery,
} from "./schema.js";

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

  /**
   * Workspace-wide report list with optional `projectId` filter and paginated
   * `{ items, total }` response. Mirrors `run/repository.ts:list()` and is
   * consumed by the dashboard's `/reports` top-level view.
   *
   * `workspaceId` is enforced when supplied — added as a relation filter on
   * the owning project so the result is scoped to one tenant. The handler
   * always threads `req.workspaceId` here.
   */
  async list(params: ListReportsQuery & { workspaceId?: string }) {
    const where: Prisma.ReportWhereInput = {};
    if (params.projectId) where.projectId = params.projectId;
    if (params.workspaceId) {
      where.project = { workspaceId: params.workspaceId };
    }
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total };
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
