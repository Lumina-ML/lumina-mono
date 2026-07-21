/**
 * Types for the legacy artifact-portfolio link endpoint
 * `POST /api/v1/versions/:id/link`.
 */

export interface LinkArtifactInput {
  portfolioName: string;
  portfolioProject: string;
  portfolioEntity?: string;
  aliases?: string[];
}

export interface LinkArtifactResponse {
  linkId: string;
  artifactVersionId: string;
  portfolioName: string;
  portfolioProject: string;
  aliases: string[];
  versionIndex: number;
  createdAt: string;
}
