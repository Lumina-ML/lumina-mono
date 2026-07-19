import { ref, type Ref } from "vue";

export interface UseToggleOptions {
  defaultValue?: boolean;
}

export interface UseToggleReturn {
  value: Ref<boolean>;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
  set: (value: boolean) => void;
}

/**
 * 布尔开关 Composable。
 */
export function useToggle(options: UseToggleOptions = {}): UseToggleReturn {
  const value = ref(options.defaultValue ?? false);

  function toggle() {
    value.value = !value.value;
  }

  function setTrue() {
    value.value = true;
  }

  function setFalse() {
    value.value = false;
  }

  function set(next: boolean) {
    value.value = next;
  }

  return {
    value,
    toggle,
    setTrue,
    setFalse,
    set,
  };
}
