export interface StorageProvider {
  /** Generate a presigned URL for uploading an object. */
  getUploadUrl(key: string, expiresSeconds?: number): Promise<string>;

  /** Generate a presigned URL for downloading an object. */
  getDownloadUrl(key: string, expiresSeconds?: number): Promise<string>;

  /** Delete an object from storage. */
  delete(key: string): Promise<void>;
}
