export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface LogLine {
  level: LogLevel;
  message: string;
  step: number | null;
  timestamp: string;
}

export interface LogLinesInput {
  logs: Array<{
    level?: LogLevel;
    message: string;
    step?: number;
    timestamp?: string;
  }>;
}

export interface ListLogLinesQuery {
  level?: LogLevel;
  limit?: number;
}
