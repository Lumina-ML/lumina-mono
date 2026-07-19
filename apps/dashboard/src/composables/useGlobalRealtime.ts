import { onScopeDispose, watch } from "vue";
import { realtime } from "@/services/ws";
import { useNotificationsStore } from "@/stores/notifications";
import { useToast } from "@/composables/useToast";
import { useWorkspaceStore } from "@/stores/workspace";
import type { DomainEvent } from "@/utils/domain-events";

/**
 * Global WebSocket subscriptions for cross-page events. Currently
 * subscribes to:
 *   - "global" (when the server emits workspace-wide events)
 *   - "user:<userId>" (per-user notifications, e.g. key rotations)
 *
 * Per-resource channels (run:<id>, project:<id>) are still scoped per
 * page via `useRealtimeSubscription`. This composable just deals with
 * the inbox-level notifications.
 *
 * Each event is also surfaced as a transient toast so the user notices
 * it without having to open the bell. The notification inbox keeps the
 * full history so the user can revisit / link to the resource later.
 */
export function useGlobalRealtime() {
  const notifications = useNotificationsStore();
  const toast = useToast();

  function handle(event: DomainEvent) {
    switch (event.type) {
      case "RunFinished": {
        const { runId, projectId, status } = event.payload;
        notifications.push({
          id: `run-finished:${runId}:${status}`,
          source: "RunFinished",
          level:
            status === "finished"
              ? "success"
              : status === "preempting"
                ? "warning"
                : "error",
          title: `Run ${status}`,
          body: `Run ${runId.slice(0, 12)}… finished with status ${status}.`,
          link: `/projects/${projectId}/runs/${runId}`,
          meta: { runId, projectId, status },
        });
        const variant =
          status === "finished"
            ? "success"
            : status === "preempting"
              ? "warning"
              : "error";
        toast.show(`Run ${runId.slice(0, 12)}… ${status}`, {
          variant,
          duration: 5000,
        });
        return;
      }
      case "ArtifactUploaded": {
        const { artifactVersionId, projectId, fileCount } = event.payload;
        notifications.push({
          id: `artifact-uploaded:${artifactVersionId}`,
          source: "ArtifactUploaded",
          level: "info",
          title: "Artifact uploaded",
          body: `${fileCount} file(s) added to a new artifact version.`,
          link: `/projects/${projectId}/artifacts`,
          meta: { artifactVersionId, projectId, fileCount },
        });
        toast.info(
          `Artifact uploaded (${fileCount} file${fileCount === 1 ? "" : "s"})`,
          { duration: 4000 },
        );
        return;
      }
      case "RunCreated": {
        // Quiet — don't spam the inbox for every run start.
        return;
      }
      case "MetricLogged": {
        // Same — too chatty for the inbox. Live charts get it via
        // per-run subscriptions on the RunDetail page.
        return;
      }
    }
  }

  // Subscribe to the current workspace's channel and re-target when the
  // user switches workspaces (the server fans out events per workspace
  // channel, so each tab must follow its own selection).
  const workspaceStore = useWorkspaceStore();
  let unsub = realtime.subscribe(`workspace:${workspaceStore.currentId}`, handle);
  const stopWatch = watch(
    () => workspaceStore.currentId,
    (next) => {
      unsub();
      unsub = realtime.subscribe(`workspace:${next}`, handle);
    },
  );

  onScopeDispose(() => {
    stopWatch();
    unsub();
  });
}
