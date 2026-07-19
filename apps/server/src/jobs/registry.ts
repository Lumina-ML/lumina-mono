import { MetricLoggedProcessor } from "./processors/metric-logged-processor.js";
import { RunFinishedProcessor } from "./processors/run-finished-processor.js";
import { ArtifactUploadedProcessor } from "./processors/artifact-uploaded-processor.js";
import type { JobProcessor } from "./types.js";

export function createJobRegistry(): JobProcessor[] {
  return [
    new MetricLoggedProcessor(),
    new RunFinishedProcessor(),
    new ArtifactUploadedProcessor(),
  ];
}
