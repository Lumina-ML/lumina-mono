import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { CreateRunAlertInput } from "./schema.js";

@injectable()
export class RunAlertService {
  constructor(@inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  async create(runId: string, data: CreateRunAlertInput) {
    return this.prisma.runAlert.create({
      data: {
        runId,
        title: data.title,
        text: data.text,
        level: data.level ?? "INFO",
      },
    });
  }

  async list(runId: string, limit = 100) {
    return this.prisma.runAlert.findMany({
      where: { runId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}