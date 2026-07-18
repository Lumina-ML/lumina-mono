import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "../../core/storage/object-storage.js";

export interface LocalStorageConfig {
  baseUrl: string;
  basePath: string;
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly config: LocalStorageConfig) {}

  private objectPath(key: string) {
    return path.join(this.config.basePath, key);
  }

  async getUploadUrl(key: string) {
    return `${this.config.baseUrl}/uploads/${key}`;
  }

  async getDownloadUrl(key: string) {
    return `${this.config.baseUrl}/uploads/${key}`;
  }

  async put(key: string, data: Buffer) {
    const filePath = this.objectPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async getBuffer(key: string) {
    return readFile(this.objectPath(key));
  }

  async delete(key: string) {
    await unlink(this.objectPath(key));
  }
}
