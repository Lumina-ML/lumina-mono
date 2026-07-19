import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { WorkspaceService, type User } from "@/services/workspace.service";
import { ApiError } from "@/services/api";

/**
 * Auth state for the dashboard.
 *
 * Source of truth for the API key — `services/api.ts` reads it from
 * here on every request, with `VITE_LUMINA_API_KEY` as a build-time
 * fallback so the dashboard can boot in environments without a user
 * (e.g. CI smoke tests).
 *
 * The user record is loaded lazily after `login()` succeeds and
 * refreshed on `fetchCurrentUser()`. It's not persisted — the API key
 * is the durable credential.
 */
const STORAGE_KEY = "lumina:auth:apiKey";

function loadInitialKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function loadInitialEnvKey(): string | null {
  const v = import.meta.env.VITE_LUMINA_API_KEY;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export const useAuthStore = defineStore("auth", () => {
  const apiKey = ref<string | null>(loadInitialKey() ?? loadInitialEnvKey());
  const user = ref<User | null>(null);
  const status = ref<"idle" | "loading" | "authenticated" | "error">("idle");
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => Boolean(apiKey.value));

  function persistKey(value: string | null) {
    if (typeof window === "undefined") return;
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore quota / private-mode errors
    }
  }

  async function fetchCurrentUser(): Promise<User | null> {
    if (!apiKey.value) {
      user.value = null;
      return null;
    }
    try {
      const u = await WorkspaceService.getCurrentUser();
      user.value = u;
      error.value = null;
      status.value = "authenticated";
      return u;
    } catch (e) {
      // 401 = bad key, clear it so the guard redirects to /login.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearKey();
        status.value = "idle";
        return null;
      }
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      status.value = "error";
      return null;
    }
  }

  /**
   * Validate the given API key, store it on success, and load the user.
   * Returns the user record on success, `null` on failure (with `error`
   * populated).
   */
  async function login(key: string): Promise<User | null> {
    const trimmed = key.trim();
    if (!trimmed) {
      error.value = "API key is required";
      status.value = "error";
      return null;
    }
    status.value = "loading";
    error.value = null;
    apiKey.value = trimmed;
    persistKey(trimmed);
    const u = await fetchCurrentUser();
    if (!u) {
      // fetchCurrentUser already cleared the key on 401.
      return null;
    }
    return u;
  }

  function logout() {
    apiKey.value = null;
    user.value = null;
    status.value = "idle";
    error.value = null;
    persistKey(null);
  }

  /** Convenience for dev: drop the persisted key without touching user state. */
  function clearKey() {
    apiKey.value = null;
    persistKey(null);
  }

  /**
   * Rotate the API key for the current user. Calls
   * `POST /api/v1/users/:userId/api-key` and stores the new key.
   * Returns the new key on success.
   */
  async function rotateKey(): Promise<string | null> {
    if (!user.value) {
      error.value = "Not authenticated";
      return null;
    }
    try {
      const resp = await WorkspaceService.generateApiKey(user.value.id);
      apiKey.value = resp.apiKey;
      persistKey(resp.apiKey);
      return resp.apiKey;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return null;
    }
  }

  return {
    apiKey,
    user,
    status,
    error,
    isAuthenticated,
    login,
    logout,
    rotateKey,
    fetchCurrentUser,
    clearKey,
  };
});
