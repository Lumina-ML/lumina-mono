import { defineStore } from "pinia";
import { computed, ref } from "vue";

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface AppNotification {
  /** Stable id so dedup + persist is straightforward. */
  id: string;
  level: NotificationLevel;
  title: string;
  body?: string;
  /** ISO timestamp string. */
  occurredAt: string;
  /** When set, clicking the notification navigates here. */
  link?: string;
  /** Source event type, e.g. "RunFinished". */
  source?: string;
  /** Free-form metadata kept for debugging / future filters. */
  meta?: Record<string, unknown>;
  read: boolean;
}

const MAX_KEEP = 50;
const STORAGE_KEY = "lumina:notifications";

function loadInitial(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (n): n is AppNotification =>
          typeof n === "object" &&
          n !== null &&
          typeof (n as AppNotification).id === "string",
      )
      .slice(0, MAX_KEEP);
  } catch {
    return [];
  }
}

export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref<AppNotification[]>(loadInitial());
  const open = ref(false);

  const unreadCount = computed(
    () => items.value.filter((n) => !n.read).length,
  );

  function persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value));
    } catch {
      /* ignore quota */
    }
  }

  /**
   * Push a new notification. If an item with the same `id` already
   * exists, the existing one is replaced (so reconnection replays
   * don't duplicate history).
   */
  function push(n: Omit<AppNotification, "read" | "occurredAt"> & { occurredAt?: string }) {
    const id = n.id;
    const occurredAt = n.occurredAt ?? new Date().toISOString();
    const existing = items.value.findIndex((x) => x.id === id);
    const next: AppNotification = { ...n, id, occurredAt, read: false };
    if (existing >= 0) {
      items.value.splice(existing, 1, next);
    } else {
      items.value = [next, ...items.value].slice(0, MAX_KEEP);
    }
    persist();
  }

  function markAllRead() {
    items.value = items.value.map((n) => (n.read ? n : { ...n, read: true }));
    persist();
  }

  function markRead(id: string) {
    const idx = items.value.findIndex((n) => n.id === id);
    if (idx < 0 || items.value[idx]!.read) return;
    items.value.splice(idx, 1, { ...items.value[idx]!, read: true });
    persist();
  }

  function dismiss(id: string) {
    items.value = items.value.filter((n) => n.id !== id);
    persist();
  }

  function clear() {
    items.value = [];
    persist();
  }

  function show() {
    open.value = true;
  }

  function hide() {
    open.value = false;
  }

  return {
    items,
    open,
    unreadCount,
    push,
    markAllRead,
    markRead,
    dismiss,
    clear,
    show,
    hide,
  };
});
