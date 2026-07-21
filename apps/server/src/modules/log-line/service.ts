import { inject, injectable } from "tsyringe";
import type { TimeSeriesStorage } from "../../core/storage/time-series-storage.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { LogLinesInput } from "./schema.js";

@injectable()
export class LogLineService {
  constructor(@inject(TOKENS.TimeSeriesStorage) private readonly storage: TimeSeriesStorage) {}

  async log(runId: string, projectId: string, data: LogLinesInput) {
    const rows = data.logs.map((log) => ({
      runId,
      projectId,
      level: log.level ?? "INFO",
      message: log.message,
      step: log.step ?? null,
      timestamp: log.timestamp ?? new Date(),
    }));
    await this.storage.insertBatch("log_line", rows);
  }

  async list(runId: string, params: { level?: string; limit: number }) {
    const rows = await this.storage.query("log_line", {
      runId,
      limit: params.limit,
      orderBy: { column: "timestamp", direction: "asc" },
    });

    const levelFilter = params.level;
    const logs = rows
      .filter((row) => !levelFilter || row.level === levelFilter)
      .map((row) => ({
        level: String(row.level ?? "INFO"),
        message: String(row.message),
        step: row.step == null ? undefined : Number(row.step),
        timestamp: (row.timestamp instanceof Date
          ? row.timestamp
          : new Date(row.timestamp as string)).toISOString(),
      }));

    return { runId, logs };
  }
}