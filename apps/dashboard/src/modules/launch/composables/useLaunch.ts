import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { LaunchService } from "@/services/launch.service";

export function useLaunchQueues(projectId: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => ["launch-queues", projectId.value]),
    queryFn: async () => {
      if (!projectId.value) return { items: [], total: 0 };
      return LaunchService.listQueues(projectId.value, { limit: 200 });
    },
    enabled: computed(() => !!projectId.value),
  });
}

export function useLaunchJobs(projectId: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => ["launch-jobs", projectId.value]),
    queryFn: async () => {
      if (!projectId.value) return { items: [], total: 0 };
      return LaunchService.listJobs(projectId.value, { limit: 200 });
    },
    enabled: computed(() => !!projectId.value),
  });
}

export function useLaunchRunsByQueue(queueId: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => ["launch-runs", "by-queue", queueId.value]),
    queryFn: async () => {
      if (!queueId.value) return { items: [], total: 0 };
      return LaunchService.listRunsByQueue(queueId.value, { limit: 50 });
    },
    enabled: computed(() => !!queueId.value),
  });
}