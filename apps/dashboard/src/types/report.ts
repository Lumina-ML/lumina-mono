export interface Report {
  id: string;
  projectId: string;
  title: string;
  blocks: Array<Record<string, unknown>>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  title: string;
  blocks?: Array<Record<string, unknown>>;
  createdBy?: string;
}

export interface ListReportsQuery {
  projectId?: string;
  limit?: number;
  offset?: number;
}