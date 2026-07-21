import { inject, injectable } from "tsyringe";
import type { ObjectStorage } from "../../core/storage/object-storage.js";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import { NotFoundError } from "../../core/errors/app-error.js";

@injectable()
export class RunFileService {
  constructor(
    @inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TOKENS.Storage) private readonly storage: ObjectStorage,
  ) {}

  /**
   * Persist a file under `runs/{runId}/files/{path}`. Used by
   * `lumina.Run.save()`. We store the file content in object storage and
   * record metadata (path, size, mime type) in the run's `metadata.files`
   * JSON map for fast listing without scanning object storage.
   */
  async save(
    runId: string,
    args: { path: string; contentBase64: string; policy: "live" | "now" },
  ): Promise<{ path: string; size: number; storedAt: string }> {
    const buffer = Buffer.from(args.contentBase64, "base64");
    const key = this.keyFor(runId, args.path);
    await this.storage.put(key, buffer);

    const run = await this.prisma.run.findUnique({ where: { runId } });
    if (!run) {
      throw new NotFoundError("Run", runId);
    }
    const metadata = (run.metadata as Record<string, unknown>) ?? {};
    const files = (metadata.files as Record<string, { size: number; storedAt: string }>) ?? {};
    files[args.path] = { size: buffer.byteLength, storedAt: new Date().toISOString() };
    metadata.files = files;

    await this.prisma.run.update({
      where: { runId },
      data: { metadata: metadata as Record<string, never> },
    });

    return {
      path: args.path,
      size: buffer.byteLength,
      storedAt: files[args.path].storedAt,
    };
  }

  async list(runId: string): Promise<Array<{ path: string; size: number; storedAt: string }>> {
    const run = await this.prisma.run.findUnique({ where: { runId } });
    if (!run) return [];
    const metadata = (run.metadata as Record<string, unknown>) ?? {};
    const files = (metadata.files as Record<string, { size: number; storedAt: string }>) ?? {};
    return Object.entries(files).map(([path, info]) => ({
      path,
      size: info.size,
      storedAt: info.storedAt,
    }));
  }

  async get(runId: string, path: string): Promise<{ contentBase64: string; size: number } | null> {
    const key = this.keyFor(runId, path);
    try {
      const buffer = await this.storage.getBuffer(key);
      return { contentBase64: buffer.toString("base64"), size: buffer.byteLength };
    } catch (err) {
      // Storage layer throws on missing keys; surface as null to handler.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  private keyFor(runId: string, path: string): string {
    // Object keys may not contain leading slashes; normalize.
    const cleanPath = path.replace(/^\/+/, "");
    return `runs/${runId}/files/${cleanPath}`;
  }
}