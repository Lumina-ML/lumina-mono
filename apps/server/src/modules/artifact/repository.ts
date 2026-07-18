import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateArtifactInput,
  CreateArtifactVersionInput,
  CreateArtifactFileInput,
  PatchArtifactVersionInput,
} from "./schema.js";

export class ArtifactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createArtifact(projectId: string, data: CreateArtifactInput) {
    return this.prisma.artifact.create({
      data: {
        projectId,
        name: data.name,
        type: data.type,
        description: data.description,
      },
    });
  }

  async findArtifactById(id: string) {
    return this.prisma.artifact.findUnique({
      where: { id },
      include: { versions: { orderBy: { createdAt: "desc" } } },
    });
  }

  async findArtifactByName(projectId: string, name: string) {
    return this.prisma.artifact.findUnique({
      where: { projectId_name: { projectId, name } },
    });
  }

  async listArtifactsByProject(projectId: string) {
    return this.prisma.artifact.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createVersion(artifactId: string, data: CreateArtifactVersionInput) {
    return this.prisma.artifactVersion.create({
      data: {
        artifactId,
        version: data.version,
        aliases: data.aliases,
        metadata: data.metadata as Record<string, never>,
      },
    });
  }

  async findVersionById(id: string) {
    return this.prisma.artifactVersion.findUnique({
      where: { id },
      include: { files: true, artifact: true },
    });
  }

  async findVersionByAlias(artifactId: string, alias: string) {
    return this.prisma.artifactVersion.findFirst({
      where: { artifactId, aliases: { has: alias } },
      include: { files: true, artifact: true },
    });
  }

  async listVersionsByArtifact(artifactId: string) {
    return this.prisma.artifactVersion.findMany({
      where: { artifactId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateVersion(id: string, data: PatchArtifactVersionInput) {
    const updateData: Record<string, unknown> = {};
    if (data.aliases !== undefined) updateData.aliases = data.aliases;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Record<string, never>;
    if (data.state !== undefined) updateData.state = data.state;

    return this.prisma.artifactVersion.update({
      where: { id },
      data: updateData,
    });
  }

  async createFile(versionId: string, storageKey: string, data: CreateArtifactFileInput) {
    return this.prisma.artifactFile.create({
      data: {
        artifactVersionId: versionId,
        path: data.path,
        size: data.size,
        md5: data.md5,
        storageKey,
      },
    });
  }

  async listFilesByVersion(versionId: string) {
    return this.prisma.artifactFile.findMany({
      where: { artifactVersionId: versionId },
      orderBy: { path: "asc" },
    });
  }
}
