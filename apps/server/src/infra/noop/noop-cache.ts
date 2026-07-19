import type { Cache } from "../../core/cache/cache.js";

export class NoopCache implements Cache {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async set(): Promise<void> {
    // No-op
  }

  async delete(): Promise<void> {
    // No-op
  }
}
