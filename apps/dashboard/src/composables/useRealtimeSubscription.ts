import { onScopeDispose, ref, watch, type Ref } from "vue";
import { realtime, type ConnectionStatus } from "@/services/ws";
import type { DomainEvent } from "@/utils/domain-events";

/**
 * Subscribe to a realtime channel for the lifetime of the calling scope.
 *
 * Usage:
 *   const { status } = useRealtimeSubscription(
 *     computed(() => `run:${runId.value}`),
 *     (event) => { /* invalidate queries, etc. *\/ },
 *   );
 *
 * The subscription is automatically torn down when the surrounding component
 * unmounts (or when the channel ref changes — e.g. user navigates to a
 * different run).
 */
export function useRealtimeSubscription(
  channel: Ref<string | null | undefined>,
  onEvent: (event: DomainEvent) => void,
): { status: Ref<ConnectionStatus> } {
  const status = ref<ConnectionStatus>(realtime.getStatus());

  let unsubChannel: (() => void) | null = null;
  const unsubStatus = realtime.onStatus((s) => {
    status.value = s;
  });

  const attach = (ch: string) => {
    unsubChannel?.();
    unsubChannel = realtime.subscribe(ch, onEvent);
  };
  const detach = () => {
    unsubChannel?.();
    unsubChannel = null;
  };

  if (channel.value) attach(channel.value);

  const stopWatch = watch(channel, (next) => {
    if (next) attach(next);
    else detach();
  });

  onScopeDispose(() => {
    stopWatch();
    detach();
    unsubStatus();
  });

  return { status };
}