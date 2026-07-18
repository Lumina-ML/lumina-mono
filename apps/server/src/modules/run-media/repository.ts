import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateRunMediaInput, ListRunMediaQuery } from "./schema.js";

export class RunMediaRepository {
  constructor(private readonly prisma: PrismaClient) { }

  async createRunMedia(projectId: string, data: CreateRunMediaInput) {
    const createData: Record<string, unknown> = {
      projectId,
      key: data.key,
      type: data.type,
      artifactVersionId: data.artifactVersionId,
      metadata: data.metadata as Record<string, never>,
    };
    if (data.runId) createData.runId = data.runId;
    return this.prisma.runMedia.create({ data: createData as never });
  }

  async findById(id: string) {
    return this.prisma.runMedia.findUnique({
      where: { id },
      include: { artifactVersion: { include: { files: true, artifact: true } } },
    });
  }

  async list(params: ListRunMediaQuery & { projectId: string }) {
    const where: Record<string, unknown> = { projectId: params.projectId };
    if (params.runId) where.runId = params.runId;
    if (params.type) where.type = params.type;

    const [items, total] = await Promise.all([
      this.prisma.runMedia.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
        include: { artifactVersion: { include: { files: true, artifact: true } } },
      }),
      this.prisma.runMedia.count({ where }),
    ]);
    return { items, total };
  }
}
