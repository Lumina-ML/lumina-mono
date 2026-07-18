export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}
