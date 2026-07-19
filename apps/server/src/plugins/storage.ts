import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ObjectStorage } from "../core/storage/object-storage.js";
import { createObjectStorage, S3ObjectStorage } from "../infra/storage/index.js";

declare module "fastify" {
  interface FastifyInstance {
    storage: ObjectStorage;
  }
}

export const storagePlugin = fp(async (app: FastifyInstance) => {
  const storage = createObjectStorage(app.config);
  if (storage instanceof S3ObjectStorage) {
    try {
      await storage.ensureBucket();
    } catch (err) {
      // Surface a clear, actionable error instead of letting Fastify's
      // plugin timeout swallow the underlying cause. The most common
      // failure mode here is a stale `S3_ENDPOINT` (e.g. a docker
      // override pointing at a host LAN IP the container can't reach).
      const endpoint = app.config.s3Endpoint ?? "(default AWS endpoint)";
      const cause = err instanceof Error ? err.message : String(err);
      throw new Error(
        `S3 storage init failed: could not reach ${endpoint} ` +
          `(bucket: ${app.config.s3Bucket}). ` +
          `Check S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / network. ` +
          `Underlying error: ${cause}`,
      );
    }
  }
  app.decorate("storage", storage);
});
