import { useMutation } from "@tanstack/vue-query";
import { ArtifactLinkService } from "@/services/artifact-link.service";
import type { LinkArtifactInput } from "@/types/artifact-link";

export function useLinkArtifactVersion() {
  return useMutation({
    mutationFn: ({
      versionId,
      data,
    }: {
      versionId: string;
      data: LinkArtifactInput;
    }) => ArtifactLinkService.linkVersion(versionId, data),
  });
}
