import type { JobContext, JobProcessor, JobPayloadByName } from "../types.js";

type Payload = JobPayloadByName["artifact.uploaded"];

export class ArtifactUploadedProcessor implements JobProcessor<"artifact.uploaded"> {
  readonly name = "artifact.uploaded";

  async process(payload: Payload, ctx: JobContext): Promise<void> {
    // The manifest (carrying `digest` + file list) is now persisted on the
    // ArtifactVersion row at finalize-time. Async side effects such as
    // thumbnail generation, embedding indexing, and content-search
    // ingestion can be hooked in here. For now, just log so the worker
    // surfaces activity in the registry.
    ctx.logger.info(
      {
        artifactVersionId: payload.artifactVersionId,
        projectId: payload.projectId,
        workspaceId: payload.workspaceId,
        fileCount: payload.fileCount,
        digest: payload.digest,
      },
      "Processing artifact upload",
    );
  }
}