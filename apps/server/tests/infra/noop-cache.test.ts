import { describe, expect, it } from "vitest";
import { NoopCache } from "../../src/infra/noop/noop-cache.js";

describe("NoopCache", () => {
  it("always returns undefined on get", async () => {
    const cache = new NoopCache();
    expect(await cache.get("k")).toBeUndefined();
    await cache.set("k", { v: 1 });
    expect(await cache.get("k")).toBeUndefined();
  });

  it("delete is a no-op", async () => {
    const cache = new NoopCache();
    await cache.delete("anything");
  });
});