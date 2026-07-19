export interface ObjectStorage {
  /** Generate a presigned URL for uploading an object. */
  getUploadUrl(key: string, expiresSeconds?: number): Promise<string>;

  /** Generate a presigned URL for downloading an object. */
  getDownloadUrl(key: string, expiresSeconds?: number): Promise<string>;

  /** Server-side direct upload. Used by handlers that receive file content. */
  put(key: string, data: Buffer): Promise<void>;

  /** Server-side direct download. Returns the raw object bytes. */
  getBuffer(key: string): Promise<Buffer>;

  /** Delete an object from storage. */
  delete(key: string): Promise<void>;
}