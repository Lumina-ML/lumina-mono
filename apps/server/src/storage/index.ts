import type { StorageProvider } from "./interface.js";
import { S3StorageProvider } from "./s3.js";
import { LocalStorageProvider } from "./local.js";

export type { StorageProvider };
export { S3StorageProvider, LocalStorageProvider };

export interface StorageOptions {
  type: "local" | "s3";
  localBaseUrl: string;
  localBasePath: string;
  s3Endpoint?: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3ForcePathStyle?: boolean;
}

export function createStorageProvider(options: StorageOptions): StorageProvider {
  if (options.type === "s3") {
    return new S3StorageProvider({
      endpoint: options.s3Endpoint,
      bucket: options.s3Bucket,
      region: options.s3Region,
      accessKeyId: options.s3AccessKeyId,
      secretAccessKey: options.s3SecretAccessKey,
      forcePathStyle: options.s3ForcePathStyle,
    });
  }

  return new LocalStorageProvider({
    baseUrl: options.localBaseUrl,
    basePath: options.localBasePath,
  });
}
