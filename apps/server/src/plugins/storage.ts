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
    await storage.ensureBucket();
  }
  app.decorate("storage", storage);
});
