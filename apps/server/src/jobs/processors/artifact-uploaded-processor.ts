import type { JobProcessor, JobContext } from "../types.js";

export class ArtifactUploadedProcessor implements JobProcessor {
  readonly name = "artifact.uploaded";

  async process(
    job: { name: string; payload: unknown },
    _ctx: JobContext,
  ): Promise<void> {
    const payload = job.payload as {
      artifactVersionId: string;
      projectId: string;
      fileCount: number;
      digest?: string;
    };

    // The manifest (carrying `digest` + file list) is now persisted on the
    // ArtifactVersion row at finalize-time. Async side effects such as
    // thumbnail generation, embedding indexing, and content-search
    // ingestion can be hooked in here. For now, just log so the worker
    // surfaces activity in the registry.
    console.log(
      `Processing artifact upload: ${payload.artifactVersionId} ` +
        `(${payload.fileCount} files, digest=${payload.digest ?? "n/a"})`,
    );
  }
}