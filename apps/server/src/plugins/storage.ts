import fp from "fastify-plugin";
import {
  createStorageProvider,
  S3StorageProvider,
  type StorageProvider,
  type StorageOptions,
} from "../storage/index.js";

declare module "fastify" {
  interface FastifyInstance {
    storage: StorageProvider;
  }
}

function parseStorageOptions(): StorageOptions {
  const type = process.env.STORAGE_TYPE ?? "local";
  if (type !== "local" && type !== "s3") {
    throw new Error(`Unsupported STORAGE_TYPE: ${type}`);
  }

  return {
    type,
    localBaseUrl: process.env.LOCAL_STORAGE_BASE_URL ?? "http://localhost:8000/api/v1",
    localBasePath: process.env.LOCAL_STORAGE_PATH ?? "./uploads",
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Bucket: process.env.S3_BUCKET ?? "lumina-artifacts",
    s3Region: process.env.S3_REGION ?? "us-east-1",
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

export const storagePlugin = fp(async (app) => {
  const options = parseStorageOptions();
  const storage = createStorageProvider(options);
  if (storage instanceof S3StorageProvider) {
    await storage.ensureBucket();
  }
  app.decorate("storage", storage);
});
