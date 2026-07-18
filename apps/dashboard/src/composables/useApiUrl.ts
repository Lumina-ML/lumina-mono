import { computed } from "vue";

export function useApiUrl() {
  const baseUrl = import.meta.env.VITE_LUMINA_API_URL || "";

  const apiUrl = computed(() => {
    return baseUrl || "";
  });

  return {
    apiUrl,
    baseUrl,
  };
}
