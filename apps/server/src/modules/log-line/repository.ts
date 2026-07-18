import type { PrismaClient } from "../../generated/prisma/index.js";
import type { LogLinesInput } from "./schema.js";

export class LogLineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(runId: string, projectId: string, data: LogLinesInput) {
    const logs = data.logs.map((log) => ({
      runId,
      projectId,
      level: log.level,
      message: log.message,
      step: log.step,
      timestamp: log.timestamp ?? new Date(),
    }));

    await this.prisma.logLine.createMany({
      data: logs,
    });
  }

  async list(runId: string, params: { level?: string; limit: number }) {
    const where: Record<string, unknown> = { runId };
    if (params.level) where.level = params.level;

    const logs = await this.prisma.logLine.findMany({
      where,
      orderBy: { timestamp: "asc" },
      take: params.limit,
    });

    return {
      runId,
      logs: logs.map((log) => ({
        level: log.level,
        message: log.message,
        step: log.step,
        timestamp: log.timestamp.toISOString(),
      })),
    };
  }
}
