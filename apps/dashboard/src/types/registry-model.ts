export interface RegistryModel {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    versions: number;
  };
}

export interface RegistryModelVersion {
  id: string;
  modelId: string;
  version: string;
  artifactVersionId: string;
  aliases: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateRegistryModelInput {
  name: string;
  description?: string;
}

export interface PatchRegistryModelVersionInput {
  aliases?: string[];
  metadata?: Record<string, unknown>;
}

export interface ListRegistryModelsQuery {
  projectId?: string;
  limit?: number;
  offset?: number;
}