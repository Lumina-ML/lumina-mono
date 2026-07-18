import { watch, onUnmounted, type Ref } from "vue";

export function useAutoRefresh(enabled: Ref<boolean>, intervalMs: number, callback: () => void) {
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      callback();
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  watch(
    enabled,
    (isEnabled) => {
      if (isEnabled) {
        start();
      } else {
        stop();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stop();
  });

  return { start, stop };
}
