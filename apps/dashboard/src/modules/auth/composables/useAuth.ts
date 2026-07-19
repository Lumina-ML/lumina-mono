import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";

/**
 * Thin wrapper that exposes the auth store with a more view-friendly
 * shape (computed-only, no Pinia noise). Use this from .vue files; use
 * `useAuthStore()` directly from .ts files for state mutations.
 */
export function useAuth() {
  const store = useAuthStore();
  return {
    apiKey: computed(() => store.apiKey),
    user: computed(() => store.user),
    isAuthenticated: computed(() => store.isAuthenticated),
    status: computed(() => store.status),
    error: computed(() => store.error),
    login: store.login.bind(store),
    logout: store.logout.bind(store),
    rotateKey: store.rotateKey.bind(store),
  };
}
