import type { ServerConfig } from "../../config/index.js";
import type { ObjectStorage } from "../../core/storage/object-storage.js";
import { LocalObjectStorage } from "./local.js";
import { S3ObjectStorage } from "./s3.js";

export { LocalObjectStorage, S3ObjectStorage };

export function createObjectStorage(config: ServerConfig): ObjectStorage {
  if (config.storageType === "s3") {
    return new S3ObjectStorage({
      endpoint: config.s3Endpoint,
      bucket: config.s3Bucket,
      region: config.s3Region,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      forcePathStyle: config.s3ForcePathStyle,
    });
  }

  return new LocalObjectStorage({
    baseUrl: config.localStorageBaseUrl,
    basePath: config.localStoragePath,
  });
}
