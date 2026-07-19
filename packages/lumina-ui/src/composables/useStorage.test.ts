import { describe, it, expect, beforeEach } from "vitest";
import { useLocalStorage, useSessionStorage } from "./useStorage";

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: new MockStorage(), writable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: new MockStorage(), writable: true });
});

describe("useLocalStorage", () => {
  it("reads existing value", () => {
    localStorage.setItem("foo", JSON.stringify("bar"));
    const value = useLocalStorage<string>("foo");
    expect(value.value).toBe("bar");
  });

  it("uses default value when missing", () => {
    const value = useLocalStorage("missing", { defaultValue: 42 });
    expect(value.value).toBe(42);
  });

  it("writes value back to storage", () => {
    const value = useLocalStorage<string>("key");
    value.value = "hello";
    expect(localStorage.getItem("key")).toBe('"hello"');
  });

  it("removes item when set to undefined", () => {
    localStorage.setItem("key", "123");
    const value = useLocalStorage<string>("key");
    value.value = undefined;
    expect(localStorage.getItem("key")).toBeNull();
  });
});

describe("useSessionStorage", () => {
  it("uses session storage", () => {
    const value = useSessionStorage("session-key", { defaultValue: true });
    expect(value.value).toBe(true);
    value.value = false;
    expect(sessionStorage.getItem("session-key")).toBe("false");
  });
});
