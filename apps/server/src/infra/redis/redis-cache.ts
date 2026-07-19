import { Redis } from "ioredis";
import type { Cache } from "../../core/cache/cache.js";

export interface RedisCacheConfig {
  url: string;
  keyPrefix?: string;
}

export class RedisCache implements Cache {
  private readonly client: Redis;
  private readonly keyPrefix: string;

  constructor(config: RedisCacheConfig) {
    this.client = new Redis(config.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.keyPrefix = config.keyPrefix ? `${config.keyPrefix}:` : "";
  }

  private key(k: string): string {
    return `${this.keyPrefix}${k}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.client.get(this.key(key));
    if (value === null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await this.client.setex(this.key(key), ttlSeconds, serialized);
    } else {
      await this.client.set(this.key(key), serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.key(key));
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
