import { MetricLoggedProcessor } from "./processors/metric-logged-processor.js";
import { RunFinishedProcessor } from "./processors/run-finished-processor.js";
import { ArtifactUploadedProcessor } from "./processors/artifact-uploaded-processor.js";
import { LaunchRunProcessor } from "./processors/launch-run-processor.js";
import type { AnyJobProcessor } from "./types.js";

export function createJobRegistry(): AnyJobProcessor[] {
  return [
    new MetricLoggedProcessor(),
    new RunFinishedProcessor(),
    new ArtifactUploadedProcessor(),
    new LaunchRunProcessor(),
  ];
}