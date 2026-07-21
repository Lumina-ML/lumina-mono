import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { RecordUseArtifactInput } from "./schema.js";

@injectable()
export class RunUseArtifactService {
  constructor(@inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  async create(runId: string, data: RecordUseArtifactInput) {
    // Upsert by (runId, artifactVersionId, type) — the same combination
    // can be recorded multiple times across retries; deduping keeps the
    // table small.
    return this.prisma.runUseArtifact.upsert({
      where: {
        runId_artifactVersionId_useType_key: {
          runId,
          artifactVersionId: data.artifactVersionId,
          useType: data.type ?? null as unknown as string,
        },
      } as never,
      create: {
        runId,
        artifactVersionId: data.artifactVersionId,
        useType: data.type ?? null,
      },
      update: {
        // No-op on re-record; createdAt is intentionally preserved.
      },
    });
  }
}