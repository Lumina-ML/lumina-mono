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
  files?: ArtifactFileMeta[];
  manifest?: {
    version: number;
    entries: Array<{
      path: string;
      digest: string;
      size: string;
      referenceUri?: string;
      contentType?: string;
    }>;
  };
}

export interface ArtifactFileMeta {
  id: string;
  versionId: string;
  path: string;
  size: number;
  sha256?: string;
  contentType?: string;
  referenceUri?: string;
  uploadUrl?: string;
  downloadUrl?: string;
}

export interface CreateArtifactInput {
  name: string;
  type?: ArtifactType;
  description?: string;
}

export interface PatchArtifactVersionInput {
  aliases?: string[];
  metadata?: Record<string, unknown>;
  state?: ArtifactVersionState;
}

export interface CreateArtifactFileInput {
  path: string;
  size: number;
  sha256?: string;
  contentType?: string;
  referenceUri?: string;
}

export type LineageType = "derived_from" | "used" | "produced" | "forked";

export interface LineageEdge {
  id: string;
  childVersionId: string;
  parentVersionId: string;
  type: LineageType;
  createdAt: string;
}

export interface ListArtifactsQuery {
  projectId?: string;
  type?: ArtifactType;
  limit?: number;
  offset?: number;
}