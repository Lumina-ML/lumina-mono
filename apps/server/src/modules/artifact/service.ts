import crypto from "node:crypto";
import type { ObjectStorage } from "../../core/storage/object-storage.js";
import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateArtifactInput,
  CreateArtifactVersionInput,
  CreateArtifactFileInput,
  PatchArtifactVersionInput,
} from "./schema.js";
import { ArtifactRepository } from "./repository.js";

export class ArtifactService {
  private readonly repository: ArtifactRepository;

  constructor(
    prisma: PrismaClient,
    private readonly storage: ObjectStorage,
  ) {
    this.repository = new ArtifactRepository(prisma);
  }

  async createArtifact(projectId: string, data: CreateArtifactInput) {
    return this.repository.createArtifact(projectId, data);
  }

  async findArtifactById(id: string) {
    return this.repository.findArtifactById(id);
  }

  async listArtifactsByProject(projectId: string) {
    return this.repository.listArtifactsByProject(projectId);
  }

  async createVersion(artifactId: string, data: CreateArtifactVersionInput) {
    return this.repository.createVersion(artifactId, data);
  }

  async findVersionById(id: string) {
    const version = await this.repository.findVersionById(id);
    if (!version) return null;
    const files = await this.enrichFilesWithUrls(version.files);
    return { ...version, files };
  }

  async findVersionByAlias(artifactId: string, alias: string) {
    const version = await this.repository.findVersionByAlias(artifactId, alias);
    if (!version) return null;
    const files = await this.enrichFilesWithUrls(version.files);
    return { ...version, files };
  }

  async listVersionsByArtifact(artifactId: string) {
    return this.repository.listVersionsByArtifact(artifactId);
  }

  async updateVersion(id: string, data: PatchArtifactVersionInput) {
    return this.repository.updateVersion(id, data);
  }

  async addFile(
    versionId: string,
    data: CreateArtifactFileInput,
  ) {
    const version = await this.repository.findVersionById(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const storageKey = this.generateStorageKey(version.artifactId, versionId, data.path);
    const created = await this.repository.createFile(versionId, storageKey, data);
    const file = { ...created, size: created.size.toString() };
    const uploadUrl = await this.storage.getUploadUrl(storageKey);
    return { file, uploadUrl };
  }

  private async enrichFilesWithUrls(files: Array<{ storageKey: string; size: bigint } & Record<string, unknown>>) {
    return Promise.all(
      files.map(async (file) => ({
        ...file,
        size: file.size.toString(),
        downloadUrl: await this.storage.getDownloadUrl(file.storageKey),
      })),
    );
  }

  private generateStorageKey(artifactId: string, versionId: string, path: string) {
    const hash = crypto.randomUUID();
    const safePath = path.replace(/^\//, "").replace(/\//g, "_");
    return `${artifactId}/${versionId}/${hash}/${safePath}`;
  }
}
