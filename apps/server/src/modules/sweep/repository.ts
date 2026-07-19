import type { PrismaClient, Prisma } from "../../generated/prisma/index.js";
import type {
  CreateSweepInput,
  UpdateSweepInput,
  ListSweepsQuery,
} from "./schema.js";

export class SweepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(projectId: string, data: CreateSweepInput) {
    return this.prisma.sweep.create({
      data: {
        projectId,
        name: data.name,
        method: data.method,
        config: data.config as unknown as Record<string, never>,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.sweep.findUnique({
      where: { id },
      include: { runs: { orderBy: { createdAt: "desc" } } },
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.sweep.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Workspace-wide sweep list with optional `projectId` filter and paginated
   * `{ items, total }` response. Mirrors `run/repository.ts:list()` and is
   * consumed by the dashboard's `/sweeps` top-level view.
   *
   * `workspaceId` is enforced when supplied — added as a relation filter on
   * the owning project so the result is scoped to one tenant. The handler
   * always threads `req.workspaceId` here.
   */
  async list(params: ListSweepsQuery & { workspaceId?: string }) {
    const where: Prisma.SweepWhereInput = {};
    if (params.projectId) where.projectId = params.projectId;
    if (params.workspaceId) {
      where.project = { workspaceId: params.workspaceId };
    }
    const [items, total] = await Promise.all([
      this.prisma.sweep.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.sweep.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: UpdateSweepInput) {
    const updateData: Record<string, unknown> = {};
    if (data.state !== undefined) updateData.state = data.state;
    if (data.bestRunId !== undefined) updateData.bestRunId = data.bestRunId;
    if (data.config !== undefined) updateData.config = data.config as unknown as Record<string, never>;

    return this.prisma.sweep.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.prisma.sweep.delete({ where: { id } });
  }
}
