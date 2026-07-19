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
    };

    // Placeholder for async side effects: thumbnail generation, indexing, etc.
    console.log(`Processing artifact upload: ${payload.artifactVersionId} (${payload.fileCount} files)`);
  }
}
