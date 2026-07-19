import { fetchApi } from "./api";

export interface RunFileMeta {
  path: string;
  size: number;
  storedAt: string;
}

export interface RunFileContent extends RunFileMeta {
  contentBase64: string;
}

export interface SaveRunFileInput {
  path: string;
  contentBase64: string;
  policy?: "live" | "now";
}

export const RunFileService = {
  list(runId: string): Promise<RunFileMeta[]> {
    return fetchApi(`/api/v1/runs/${runId}/files`);
  },

  /**
   * Mirrors the SDK's `LuminaClient.save_run_file`. The caller is expected
   * to base64-encode the binary content.
   */
  save(runId: string, data: SaveRunFileInput): Promise<RunFileMeta> {
    return fetchApi(`/api/v1/runs/${runId}/files`, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Returns the base64-encoded file body along with metadata. Use
   * `atob(...)` (or `Buffer.from(..., "base64")` in Node) to recover the
   * original bytes. The server currently returns the file inline; for
   * large objects use a signed S3 URL instead.
   */
  get(runId: string, path: string): Promise<RunFileContent> {
    return fetchApi(`/api/v1/runs/${runId}/file`, {
      params: { path },
    });
  },
};
