import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateRegistryModelInput,
  CreateRegistryModelVersionInput,
  PatchRegistryModelVersionInput,
} from "./schema.js";

export class RegistryModelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRegistryModel(projectId: string, data: CreateRegistryModelInput) {
    return this.prisma.registryModel.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.registryModel.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          include: { artifactVersion: true },
        },
      },
    });
  }

  async findByName(projectId: string, name: string) {
    return this.prisma.registryModel.findUnique({
      where: { projectId_name: { projectId, name } },
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.registryModel.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createVersion(
    registryModelId: string,
    data: CreateRegistryModelVersionInput & { version: string },
  ) {
    return this.prisma.registryModelVersion.create({
      data: {
        registryModelId,
        version: data.version,
        artifactVersionId: data.artifactVersionId,
        aliases: data.aliases,
        metadata: data.metadata as Record<string, never>,
      },
    });
  }

  async findVersionById(id: string) {
    return this.prisma.registryModelVersion.findUnique({
      where: { id },
      include: {
        registryModel: true,
        artifactVersion: { include: { files: true } },
      },
    });
  }

  async findVersionByAlias(registryModelId: string, alias: string) {
    return this.prisma.registryModelVersion.findFirst({
      where: { registryModelId, aliases: { has: alias } },
      include: {
        registryModel: true,
        artifactVersion: { include: { files: true } },
      },
    });
  }

  async listVersionsByModel(registryModelId: string) {
    return this.prisma.registryModelVersion.findMany({
      where: { registryModelId },
      orderBy: { createdAt: "desc" },
      include: { artifactVersion: true },
    });
  }

  async updateVersion(id: string, data: PatchRegistryModelVersionInput) {
    const updateData: Record<string, unknown> = {};
    if (data.aliases !== undefined) updateData.aliases = data.aliases;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Record<string, never>;

    return this.prisma.registryModelVersion.update({
      where: { id },
      data: updateData,
    });
  }

  async countVersions(registryModelId: string) {
    return this.prisma.registryModelVersion.count({
      where: { registryModelId },
    });
  }
}
