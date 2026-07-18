import { mkdir, unlink, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { StorageProvider } from "./interface.js";

export interface LocalStorageConfig {
  baseUrl: string;
  basePath: string;
}

export class LocalStorageProvider implements StorageProvider {
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

  async getStream(key: string) {
    return createReadStream(this.objectPath(key));
  }

  async delete(key: string) {
    await unlink(this.objectPath(key));
  }
}
