import { fetchApi } from "./api";
import type { LogLine, ListLogLinesQuery, LogLinesInput } from "@/types/log-line";

export interface LogLinesResponse {
  runId: string;
  logs: LogLine[];
}

export const LogLineService = {
  list(runId: string, params?: ListLogLinesQuery): Promise<LogLinesResponse> {
    return fetchApi(`/api/v1/runs/${runId}/logs`, { params });
  },

  log(runId: string, data: LogLinesInput): Promise<{ success: boolean }> {
    return fetchApi(`/api/v1/runs/${runId}/logs`, { method: "POST", body: data });
  },
};
