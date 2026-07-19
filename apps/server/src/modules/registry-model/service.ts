import crypto from "node:crypto";
import type { ObjectStorage } from "../../core/storage/object-storage.js";
import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateRegistryModelInput,
  CreateRegistryModelVersionInput,
  PatchRegistryModelVersionInput,
} from "./schema.js";
import { RegistryModelRepository } from "./repository.js";

export class RegistryModelService {
  private readonly repository: RegistryModelRepository;

  constructor(
    prisma: PrismaClient,
    private readonly storage: ObjectStorage,
  ) {
    this.repository = new RegistryModelRepository(prisma);
  }

  async createRegistryModel(projectId: string, data: CreateRegistryModelInput) {
    return this.repository.createRegistryModel(projectId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async findByName(projectId: string, name: string) {
    return this.repository.findByName(projectId, name);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async createVersion(registryModelId: string, data: CreateRegistryModelVersionInput) {
    const version = data.version ?? (await this.generateNextVersion(registryModelId));
    return this.repository.createVersion(registryModelId, { ...data, version });
  }

  async findVersionById(id: string) {
    const version = await this.repository.findVersionById(id);
    if (!version) return null;
    const files = await this.enrichFilesWithUrls(version.artifactVersion.files);
    return { ...version, artifactVersion: { ...version.artifactVersion, files } };
  }

  async findVersionByAlias(registryModelId: string, alias: string) {
    const version = await this.repository.findVersionByAlias(registryModelId, alias);
    if (!version) return null;
    const files = await this.enrichFilesWithUrls(version.artifactVersion.files);
    return { ...version, artifactVersion: { ...version.artifactVersion, files } };
  }

  async listVersionsByModel(registryModelId: string) {
    return this.repository.listVersionsByModel(registryModelId);
  }

  async updateVersion(id: string, data: PatchRegistryModelVersionInput) {
    return this.repository.updateVersion(id, data);
  }

  private async generateNextVersion(registryModelId: string) {
    const count = await this.repository.countVersions(registryModelId);
    return `v${count + 1}`;
  }

  private async enrichFilesWithUrls(
    files: Array<{ storageKey: string | null; size: bigint } & Record<string, unknown>>,
  ) {
    return Promise.all(
      files.map(async (file) => {
        const enriched: Record<string, unknown> = {
          ...file,
          size: file.size.toString(),
        };
        if (file.storageKey) {
          enriched.downloadUrl = await this.storage.getDownloadUrl(file.storageKey);
        }
        return enriched;
      }),
    );
  }
}
