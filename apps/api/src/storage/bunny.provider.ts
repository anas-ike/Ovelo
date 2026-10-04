import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { StorageProvider, StorageUpload, StorageObjectResult } from './storage-provider.js';
import { randomUUID, createHash } from 'node:crypto';
export class BunnyProvider implements StorageProvider {
  readonly name = 'BUNNY' as const;
  constructor() {
    if (
      !env.BUNNY_ENABLED ||
      !env.BUNNY_STORAGE_ZONE ||
      !env.BUNNY_STORAGE_API_KEY ||
      !env.BUNNY_CDN_URL
    )
      throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Bunny storage is not configured.');
  }
  private url(key: string) {
    return `https://storage.bunnycdn.com/${encodeURIComponent(env.BUNNY_STORAGE_ZONE!)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  async upload(input: StorageUpload): Promise<StorageObjectResult> {
    const storageKey = `objects/${input.checksum}-${Date.now()}`;
    const response = await fetch(this.url(storageKey), {
      method: 'PUT',
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY!, 'Content-Type': input.mimeType },
      body: input.body as unknown as BodyInit,
    });
    if (!response.ok)
      throw new AppError(502, 'STORAGE_UPLOAD_FAILED', 'Bunny storage upload failed.');
    return {
      provider: this.name,
      storageKey,
      fileId: storageKey,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.body.byteLength,
      checksum: input.checksum,
    };
  }
  async download(_fileId: string, storageKey: string) {
    const response = await fetch(this.url(storageKey), {
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! },
    });
    if (!response.ok) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
    return {
      body: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      filename: storageKey.split('/').pop() ?? 'download',
    };
  }
  async delete(_fileId: string, storageKey: string) {
    const response = await fetch(this.url(storageKey), {
      method: 'DELETE',
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! },
    });
    if (!response.ok && response.status !== 404)
      throw new AppError(502, 'STORAGE_DELETE_FAILED', 'Storage provider deletion failed.');
  }
  async exists(_fileId: string, storageKey: string) {
    const response = await fetch(this.url(storageKey), {
      method: 'HEAD',
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! },
    });
    return response.ok;
  }
  async getMetadata(_fileId: string, storageKey: string) {
    const response = await fetch(this.url(storageKey), {
      method: 'HEAD',
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! },
    });
    if (!response.ok) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
    return { size: Number(response.headers.get('content-length') ?? 0) };
  }
  async getSignedUrl(): Promise<string> {
    throw new AppError(
      405,
      'PRIVATE_DOWNLOAD_ONLY',
      'Use the authenticated document download endpoint.',
    );
  }
  async createFolder() {
    return randomUUID();
  }
  async copy(fileId: string) {
    const file = await this.download(fileId, fileId);
    const stored = await this.upload({
      ...file,
      checksum: createHash('sha256').update(file.body).digest('hex'),
    });
    return stored.storageKey;
  }
  async move(fileId: string, folderId: string) {
    const file = await this.download(fileId, fileId);
    const response = await fetch(this.url(`${folderId}/${fileId}`), {
      method: 'PUT',
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! },
      body: new Uint8Array(file.body),
    });
    if (!response.ok) throw new AppError(502, 'STORAGE_MOVE_FAILED', 'Storage move failed.');
    await this.delete(fileId, fileId);
  }
}
