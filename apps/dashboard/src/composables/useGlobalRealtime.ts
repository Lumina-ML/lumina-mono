import { onScopeDispose } from "vue";
import { realtime } from "@/services/ws";
import { useNotificationsStore } from "@/stores/notifications";
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
 */
export function useGlobalRealtime() {
  const notifications = useNotificationsStore();

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

  // The server doesn't yet have a "global" channel; subscribe to a
  // workspace-wide one so we receive all events. Subscriptions are
  // idempotent — the RealtimeClient dedupes by channel name.
  const unsubGlobal = realtime.subscribe("workspace:default", handle);

  onScopeDispose(() => {
    unsubGlobal();
  });
}
