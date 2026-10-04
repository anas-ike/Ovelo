export interface StorageUpload {
  filename: string;
  mimeType: string;
  body: Buffer;
  checksum: string;
}
export interface StorageObjectResult {
  provider: 'LOCAL' | 'GOOGLE_DRIVE' | 'BUNNY';
  storageKey: string;
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
}
export interface StorageProvider {
  readonly name: StorageObjectResult['provider'];
  upload(input: StorageUpload): Promise<StorageObjectResult>;
  download(
    fileId: string,
    storageKey: string,
  ): Promise<{ body: Buffer; mimeType: string; filename: string }>;
  delete(fileId: string, storageKey: string): Promise<void>;
  exists(fileId: string, storageKey: string): Promise<boolean>;
  getMetadata(fileId: string, storageKey: string): Promise<{ size: number; checksum?: string }>;
  getSignedUrl(fileId: string, storageKey: string): Promise<string>;
  createFolder(): Promise<string>;
  move(fileId: string, folderId: string): Promise<void>;
  copy(fileId: string): Promise<string>;
}
