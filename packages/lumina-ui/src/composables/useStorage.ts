import { ref, watch, type Ref } from "vue";

function getStorage(type: "local" | "session") {
  return type === "local" ? localStorage : sessionStorage;
}

export interface UseStorageOptions<T> {
  type?: "local" | "session";
  defaultValue?: T;
  serializer?: {
    read: (value: string) => T;
    write: (value: T) => string;
  };
}

/**
 * localStorage / sessionStorage Composable。
 *
 * 自动序列化/反序列化，支持默认值，跨 tab 同步（仅 localStorage）。
 */
export function useStorage<T>(
  key: string,
  options: UseStorageOptions<T> = {},
): Ref<T | undefined> {
  const { type = "local", defaultValue, serializer } = options;

  const read = (raw: string | null): T | undefined => {
    if (raw === null) return defaultValue;
    try {
      return serializer ? serializer.read(raw) : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  };

  const write = (value: T | undefined): string => {
    if (value === undefined) return "";
    return serializer ? serializer.write(value) : JSON.stringify(value);
  };

  const stored = ref<T | undefined>(read(getStorage(type).getItem(key)));

  watch(
    stored,
    (value) => {
      if (value === undefined) {
        getStorage(type).removeItem(key);
      } else {
        getStorage(type).setItem(key, write(value));
      }
    },
    { deep: true },
  );

  if (type === "local" && typeof window !== "undefined") {
    const handler = (event: StorageEvent) => {
      if (event.key === key) {
        stored.value = read(event.newValue);
      }
    };
    window.addEventListener("storage", handler);
  }

  return stored;
}

export function useLocalStorage<T>(key: string, options?: Omit<UseStorageOptions<T>, "type">) {
  return useStorage<T>(key, { ...options, type: "local" });
}

export function useSessionStorage<T>(key: string, options?: Omit<UseStorageOptions<T>, "type">) {
  return useStorage<T>(key, { ...options, type: "session" });
}
