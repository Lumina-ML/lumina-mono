import { ref, computed, type Ref, type ComputedRef } from "vue";

export interface UseCountdownOptions {
  /** 倒计时总时长（秒） */
  duration?: number;
  /** 是否立即开始 */
  immediate?: boolean;
}

export interface UseCountdownReturn {
  remaining: Ref<number>;
  formatted: ComputedRef<string>;
  isRunning: Ref<boolean>;
  start: (duration?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * 倒计时 Composable。
 */
export function useCountdown(options: UseCountdownOptions = {}): UseCountdownReturn {
  const duration = ref(options.duration ?? 60);
  const remaining = ref(duration.value);
  const isRunning = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  const formatted = computed(() => formatSeconds(remaining.value));

  function clear() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function tick() {
    if (remaining.value <= 0) {
      pause();
      return;
    }
    remaining.value -= 1;
  }

  function start(nextDuration?: number) {
    if (nextDuration !== undefined) {
      duration.value = nextDuration;
      remaining.value = nextDuration;
    }
    clear();
    isRunning.value = true;
    timer = setInterval(tick, 1000);
  }

  function pause() {
    clear();
    isRunning.value = false;
  }

  function resume() {
    if (isRunning.value || remaining.value <= 0) return;
    start();
  }

  function reset() {
    pause();
    remaining.value = duration.value;
  }

  if (options.immediate) {
    start();
  }

  return {
    remaining,
    formatted,
    isRunning,
    start,
    pause,
    resume,
    reset,
  };
}
