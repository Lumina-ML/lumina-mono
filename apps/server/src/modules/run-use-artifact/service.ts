import type { PrismaClient } from "../../generated/prisma/index.js";
import type { RecordUseArtifactInput } from "./schema.js";

export class RunUseArtifactService {
  constructor(private readonly prisma: PrismaClient) {}

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