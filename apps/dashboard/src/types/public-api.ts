/**
 * Types for the public read-only query endpoints used by the SDK's PublicApi.
 */

import type { RunStatus } from "./run";

export interface ListPublicRunsQuery {
  project?: string;
  status?: RunStatus;
  limit?: number;
  offset?: number;
}

export interface ListPublicProjectsQuery {
  workspaceId?: string;
  limit?: number;
  offset?: number;
}
