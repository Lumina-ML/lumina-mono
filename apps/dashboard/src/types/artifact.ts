export type ArtifactType = "dataset" | "model" | "checkpoint" | "file" | "table";
export type ArtifactVersionState = "pending" | "committed" | "deleted";

export interface Artifact {
  id: string;
  projectId: string;
  name: string;
  type: ArtifactType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    versions: number;
  };
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: string;
  aliases: string[];
  state: ArtifactVersionState;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateArtifactInput {
  name: string;
  type?: ArtifactType;
  description?: string;
}

export interface ListArtifactsQuery {
  projectId?: string;
  type?: ArtifactType;
  limit?: number;
  offset?: number;
}