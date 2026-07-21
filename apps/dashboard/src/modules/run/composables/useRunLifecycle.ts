import { useQuery, useMutation } from "@tanstack/vue-query";
import { RunLifecycleService } from "@/services/run-lifecycle.service";
import type {
  RewindRunInput,
  CreateRunAlertInput,
  RecordUseArtifactInput,
} from "@/types/run-lifecycle";
import type { Ref } from "vue";

export function useRunResumeState(runId: Ref<string>) {
  return useQuery({
    queryKey: ["run-resume-state", runId],
    queryFn: () => RunLifecycleService.getResumeState(runId.value),
    enabled: () => !!runId.value,
  });
}

export function useRunShouldStop(runId: Ref<string>) {
  return useQuery({
    queryKey: ["run-should-stop", runId],
    queryFn: () => RunLifecycleService.shouldStop(runId.value),
    enabled: () => !!runId.value,
  });
}

export function useRewindRun() {
  return useMutation({
    mutationFn: ({
      runId,
      data,
    }: {
      runId: string;
      data: RewindRunInput;
    }) => RunLifecycleService.rewindRun(runId, data),
  });
}

export function useSendRunAlert() {
  return useMutation({
    mutationFn: ({
      runId,
      data,
    }: {
      runId: string;
      data: CreateRunAlertInput;
    }) => RunLifecycleService.sendAlert(runId, data),
  });
}

export function useRecordRunUseArtifact() {
  return useMutation({
    mutationFn: ({
      runId,
      data,
    }: {
      runId: string;
      data: RecordUseArtifactInput;
    }) => RunLifecycleService.useArtifact(runId, data),
  });
}
