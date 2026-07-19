/**
 * Workspace store unit tests.
 *
 * Pure state-management tests — no fetch, no Vue mount. Exercises the
 * persistence + default behaviour the rest of the dashboard relies on.
 *
 * Vitest runs these in the default `node` environment, so we stub a
 * `localStorage`-shaped global with an in-memory map. The store's
 * `typeof window === "undefined"` guard means the in-memory branch is
 * the production code path under test.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useWorkspaceStore } from "@/stores/workspace";

/** Minimal `localStorage` shim so the store's persistence layer runs
 *  under node without requiring jsdom/happy-dom. */
function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("workspace store", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
    (globalThis as unknown as { window: { localStorage: typeof storage } }).window =
      { localStorage: storage };
    setActivePinia(createPinia());
  });

  it("defaults to the seeded 'default' workspace id", () => {
    const store = useWorkspaceStore();
    expect(store.currentId).toBe("default");
    expect(store.isDefault).toBe(true);
  });

  it("setCurrentId updates the in-memory + persisted value", () => {
    const store = useWorkspaceStore();
    store.setCurrentId("acme");
    expect(store.currentId).toBe("acme");
    expect(store.isDefault).toBe(false);
    expect(storage.getItem("lumina:workspace:currentId")).toBe("acme");
  });

  it("rehydrates from localStorage when the page reloads", () => {
    storage.setItem("lumina:workspace:currentId", "persisted");
    // Simulate reload by constructing a fresh Pinia instance — the store
    // re-reads localStorage on init.
    setActivePinia(createPinia());
    const store = useWorkspaceStore();
    expect(store.currentId).toBe("persisted");
    expect(store.isDefault).toBe(false);
  });
});