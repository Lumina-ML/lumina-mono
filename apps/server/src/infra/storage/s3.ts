import {
  S3Client,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { ObjectStorage } from "../../core/storage/object-storage.js";

export interface S3StorageConfig {
  endpoint?: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    const clientConfig: S3ClientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Fail fast on a wrong/unreachable endpoint (e.g. an override that
      // points at a host LAN IP the container can't see). The SDK's
      // default 30s request timeout otherwise cascades into Fastify's
      // 10s plugin timeout and produces an opaque
      // `Plugin did not start in time: 'storage-auto-3'` error. Five
      // seconds is generous for MinIO/real-S3 in-cluster; bump if you
      // ever point this across a slow link.
      requestHandler: {
        requestTimeout: 5_000,
        connectionTimeout: 2_000,
      },
    };
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }
    if (config.forcePathStyle !== undefined) {
      clientConfig.forcePathStyle = config.forcePathStyle;
    }
    this.client = new S3Client(clientConfig);
  }

  async getUploadUrl(key: string, expiresSeconds = 300) {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresSeconds });
  }

  async getDownloadUrl(key: string, expiresSeconds = 300) {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresSeconds });
  }

  async delete(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: data }),
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const stream = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!stream?.transformToByteArray) {
      throw new Error(`S3ObjectStorage: cannot read body for key ${key}`);
    }
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch (err) {
      const e = err as { name?: string; Code?: string };
      if (e.name === "NotFound" || e.Code === "NoSuchBucket" || e.Code === "404") {
        await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
      } else {
        throw err;
      }
    }
  }
}
