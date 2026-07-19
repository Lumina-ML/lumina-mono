import type { PrismaClient, Prisma } from "../../generated/prisma/index.js";
import type {
  CreateArtifactInput,
  CreateArtifactVersionInput,
  CreateArtifactFileInput,
  PatchArtifactVersionInput,
  ListArtifactsQuery,
} from "./schema.js";
import type { Manifest } from "./schema.js";

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

  /**
   * Workspace-wide artifact list with optional projectId / type filters and
   * paginated `{ items, total }` response. Used by the dashboard's top-level
   * `/artifacts` (and `/datasets`, when `type="dataset"`) views.
   *
   * `where` is built dynamically; mirrors the pattern in
   * `run/repository.ts:list()`.
   */
  async list(params: ListArtifactsQuery) {
    const where: Prisma.ArtifactWhereInput = {};
    if (params.projectId) where.projectId = params.projectId;
    if (params.type) where.type = params.type;
    const [items, total] = await Promise.all([
      this.prisma.artifact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.artifact.count({ where }),
    ]);
    return { items, total };
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

  async updateVersionManifest(id: string, manifest: Manifest, digest: string) {
    return this.prisma.artifactVersion.update({
      where: { id },
      data: { manifest: manifest as unknown as object, digest },
    });
  }

  async findFileByPath(versionId: string, path: string) {
    return this.prisma.artifactFile.findUnique({
      where: { artifactVersionId_path: { artifactVersionId: versionId, path } },
    });
  }

  async findFileByDigest(versionId: string, sha256: string) {
    return this.prisma.artifactFile.findFirst({
      where: { artifactVersionId: versionId, sha256 },
    });
  }

  async createFile(
    versionId: string,
    data: CreateArtifactFileInput & { storageKey?: string },
  ) {
    return this.prisma.artifactFile.create({
      data: {
        artifactVersionId: versionId,
        path: data.path,
        size: data.size ?? 0n,
        md5: data.md5,
        sha256: data.sha256,
        contentType: data.contentType,
        referenceUri: data.referenceUri,
        storageKey: data.storageKey,
      },
    });
  }

  async listFilesByVersion(versionId: string) {
    return this.prisma.artifactFile.findMany({
      where: { artifactVersionId: versionId },
      orderBy: { path: "asc" },
    });
  }

  // Lineage
  async attachLineage(childVersionId: string, parentVersionId: string, type: string) {
    return this.prisma.artifactLineage.upsert({
      where: {
        artifactVersionId_parentArtifactVersionId: {
          artifactVersionId: childVersionId,
          parentArtifactVersionId: parentVersionId,
        },
      },
      create: { artifactVersionId: childVersionId, parentArtifactVersionId: parentVersionId, type },
      update: { type },
    });
  }

  async detachLineage(childVersionId: string, parentVersionId: string) {
    await this.prisma.artifactLineage.deleteMany({
      where: { artifactVersionId: childVersionId, parentArtifactVersionId: parentVersionId },
    });
  }

  async listParents(childVersionId: string) {
    return this.prisma.artifactLineage.findMany({
      where: { artifactVersionId: childVersionId },
      include: { parentArtifactVersion: { include: { artifact: true } } },
    });
  }

  async listChildren(parentVersionId: string) {
    return this.prisma.artifactLineage.findMany({
      where: { parentArtifactVersionId: parentVersionId },
      include: { artifactVersion: { include: { artifact: true } } },
    });
  }
}