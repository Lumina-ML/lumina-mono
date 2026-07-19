import { fetchApi } from "./api";
import type {
  Artifact,
  ArtifactVersion,
  ArtifactFileMeta,
  CreateArtifactInput,
  PatchArtifactVersionInput,
  CreateArtifactFileInput,
  ListArtifactsQuery,
  LineageEdge,
} from "@/types/artifact";
import type { PaginatedResponse } from "@/types/project";

export const ArtifactService = {
  list(params?: ListArtifactsQuery): Promise<PaginatedResponse<Artifact>> {
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/artifacts`
      : `/api/v1/artifacts`;
    return fetchApi(path, { params: rest });
  },

  get(artifactId: string): Promise<Artifact> {
    return fetchApi(`/api/v1/artifacts/${artifactId}`);
  },

  create(projectId: string, data: CreateArtifactInput): Promise<Artifact> {
    return fetchApi(`/api/v1/projects/${projectId}/artifacts`, {
      method: "POST",
      body: data,
    });
  },

  listVersions(artifactId: string): Promise<ArtifactVersion[]> {
    return fetchApi(`/api/v1/artifacts/${artifactId}/versions`);
  },

  getVersion(versionId: string): Promise<ArtifactVersion> {
    return fetchApi(`/api/v1/versions/${versionId}`);
  },

  createVersion(
    artifactId: string,
    version: string,
    options?: { aliases?: string[]; metadata?: Record<string, unknown> },
  ): Promise<ArtifactVersion> {
    return fetchApi(`/api/v1/artifacts/${artifactId}/versions`, {
      method: "POST",
      body: { version, ...(options ?? {}) },
    });
  },

  patchVersion(
    versionId: string,
    data: PatchArtifactVersionInput,
  ): Promise<ArtifactVersion> {
    return fetchApi(`/api/v1/versions/${versionId}`, {
      method: "PATCH",
      body: data,
    });
  },

  addFile(
    versionId: string,
    data: CreateArtifactFileInput,
  ): Promise<ArtifactFileMeta> {
    return fetchApi(`/api/v1/versions/${versionId}/files`, {
      method: "POST",
      body: data,
    });
  },

  finalizeVersion(versionId: string): Promise<ArtifactVersion> {
    return fetchApi(`/api/v1/versions/${versionId}/finalize`, {
      method: "POST",
      body: {},
    });
  },

  attachLineage(
    childVersionId: string,
    parentVersionId: string,
    type: "derived_from" | "used" | "produced" | "forked" = "derived_from",
  ): Promise<LineageEdge> {
    return fetchApi(`/api/v1/versions/${childVersionId}/lineage`, {
      method: "POST",
      body: { parentVersionId, type },
    });
  },

  detachLineage(childVersionId: string, parentVersionId: string): Promise<void> {
    return fetchApi(
      `/api/v1/versions/${childVersionId}/lineage/${parentVersionId}`,
      { method: "DELETE" },
    );
  },

  listLineage(versionId: string): Promise<{ parents: LineageEdge[]; children: LineageEdge[] }> {
    return fetchApi(`/api/v1/versions/${versionId}/lineage`);
  },
};
