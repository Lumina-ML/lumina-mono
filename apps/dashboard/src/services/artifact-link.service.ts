import { fetchApi } from "./api";
import type {
  LinkArtifactInput,
  LinkArtifactResponse,
} from "@/types/artifact-link";

/**
 * Link an artifact version into a portfolio with optional aliases.
 * This is the legacy `LinkArtifact` equivalent used by the SDK.
 */
export const ArtifactLinkService = {
  linkVersion(
    versionId: string,
    data: LinkArtifactInput,
  ): Promise<LinkArtifactResponse> {
    return fetchApi(`/api/v1/versions/${versionId}/link`, {
      method: "POST",
      body: data,
    });
  },
};
