import { fetchApi } from "./api";
import type {
  Report,
  CreateReportInput,
  ListReportsQuery,
} from "@/types/report";
import type { PaginatedResponse } from "@/types/project";

export const ReportService = {
  list(params?: ListReportsQuery): Promise<PaginatedResponse<Report>> {
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/reports`
      : `/api/v1/reports`;
    return fetchApi(path, { params: rest });
  },

  get(reportId: string): Promise<Report> {
    return fetchApi(`/api/v1/reports/${reportId}`);
  },

  create(projectId: string, data: CreateReportInput): Promise<Report> {
    return fetchApi(`/api/v1/projects/${projectId}/reports`, {
      method: "POST",
      body: data,
    });
  },

  update(reportId: string, data: Partial<CreateReportInput>): Promise<Report> {
    return fetchApi(`/api/v1/reports/${reportId}`, { method: "PATCH", body: data });
  },

  delete(reportId: string): Promise<void> {
    return fetchApi(`/api/v1/reports/${reportId}`, { method: "DELETE" });
  },
};