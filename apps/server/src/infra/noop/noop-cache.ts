import type { Cache } from "../../core/cache/cache.js";

export class NoopCache implements Cache {
  async get<T>(_key: string): Promise<T | undefined> {
    return undefined;
  }

  async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    // No-op
  }

  async delete(_key: string): Promise<void> {
    // No-op
  }
}