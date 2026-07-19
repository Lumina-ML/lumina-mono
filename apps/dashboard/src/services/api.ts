const API_BASE_URL = import.meta.env.VITE_LUMINA_API_URL || "";

export interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  params?: any;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Resolve the API key at call time so a logout/login or a runtime
 * override always wins over the cached value. Reads from the Pinia auth
 * store first, then falls back to the build-time env var.
 */
function resolveApiKey(): string | null {
  try {
    // Lazy-require so tests that don't mount Pinia don't crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/stores/auth") as typeof import("@/stores/auth");
    const k = useAuthStore().apiKey;
    if (k) return k;
  } catch {
    // store not available (tests / SSR) — fall through
  }
  const v = import.meta.env.VITE_LUMINA_API_KEY;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function fetchApi<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const apiKey = resolveApiKey();

  const url = new URL(path, API_BASE_URL || window.location.origin);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body && options.method !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), init);

  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new ApiError(response.status, data, `HTTP ${response.status}`);
  }

  return data as T;
}
