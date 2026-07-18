export interface Project {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  workspaceId: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  displayName?: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  displayName?: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export interface ListProjectsQuery {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}
