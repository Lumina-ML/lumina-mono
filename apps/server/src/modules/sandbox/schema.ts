import { z } from "zod";

export const DemoScenarioSchema = z.enum([
  "basic",
  "sweep",
  "evaluation",
  "trace",
  "artifacts",
]);

export const RunExampleSchema = z.object({
  scenario: DemoScenarioSchema,
});

export const ResetDemoSchema = z.object({
  projectId: z.string().uuid(),
});

export type RunExampleInput = z.infer<typeof RunExampleSchema>;
export type ResetDemoInput = z.infer<typeof ResetDemoSchema>;