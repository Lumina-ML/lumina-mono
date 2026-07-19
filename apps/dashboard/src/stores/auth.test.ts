/**
 * Auth store unit tests.
 *
 * Focuses on persistence + key-clearing behaviour, which are the parts
 * of the store that don't require a running server. Network-bound
 * flows (login / rotateKey / fetchCurrentUser) are exercised via
 * integration tests once we wire up a mocked `fetchApi`.
 *
 * `localStorage` is stubbed via an in-memory map so the suite runs in
 * vitest's default node environment without needing jsdom/happy-dom.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "@/stores/auth";

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("auth store", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
    (globalThis as unknown as { window: { localStorage: typeof storage } }).window =
      { localStorage: storage };
    setActivePinia(createPinia());
  });

  it("starts unauthenticated and reports isAuthenticated=false", () => {
    const store = useAuthStore();
    expect(store.apiKey).toBeNull();
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it("rehydrates the api key from localStorage on init", () => {
    storage.setItem("lumina:auth:apiKey", "lm-xyz-123");
    setActivePinia(createPinia());
    const store = useAuthStore();
    expect(store.apiKey).toBe("lm-xyz-123");
    expect(store.isAuthenticated).toBe(true);
  });

  it("logout clears apiKey, user, status, and persisted key", () => {
    const store = useAuthStore();
    store.apiKey = "lm-xyz-123";
    storage.setItem("lumina:auth:apiKey", "lm-xyz-123");
    store.user = {
      id: "u1",
      email: "a@b.c",
      name: "a",
      avatar: null,
      createdAt: new Date().toISOString(),
    };

    store.logout();

    expect(store.apiKey).toBeNull();
    expect(store.user).toBeNull();
    expect(store.status).toBe("idle");
    expect(store.error).toBeNull();
    expect(storage.getItem("lumina:auth:apiKey")).toBeNull();
  });

  it("clearKey drops the persisted key without touching user state", () => {
    const store = useAuthStore();
    store.apiKey = "lm-xyz-123";
    store.user = {
      id: "u1",
      email: "a@b.c",
      name: "a",
      avatar: null,
      createdAt: new Date().toISOString(),
    };
    storage.setItem("lumina:auth:apiKey", "lm-xyz-123");

    store.clearKey();

    expect(store.apiKey).toBeNull();
    expect(store.user).not.toBeNull();
    expect(storage.getItem("lumina:auth:apiKey")).toBeNull();
  });
});