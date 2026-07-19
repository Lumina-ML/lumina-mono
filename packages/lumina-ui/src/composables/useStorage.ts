import { computed, type Ref } from "vue";

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
  const storage = getStorage(type);

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

  const stored = computed<T | undefined>({
    get: () => read(storage.getItem(key)),
    set: (value) => {
      if (value === undefined) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, write(value));
      }
    },
  });

  if (type === "local" && typeof window !== "undefined") {
    const handler = (event: StorageEvent) => {
      if (event.key === key) {
        // 触发 getter 重新读取
        // eslint-disable-next-line no-unused-expressions
        stored.value;
      }
    };
    window.addEventListener("storage", handler);
  }

  return stored as Ref<T | undefined>;
}

export function useLocalStorage<T>(key: string, options?: Omit<UseStorageOptions<T>, "type">) {
  return useStorage<T>(key, { ...options, type: "local" });
}

export function useSessionStorage<T>(key: string, options?: Omit<UseStorageOptions<T>, "type">) {
  return useStorage<T>(key, { ...options, type: "session" });
}
