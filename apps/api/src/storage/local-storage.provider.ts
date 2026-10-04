import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { StorageProvider, StorageUpload, StorageObjectResult } from './storage-provider.js';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'LOCAL' as const;
  private readonly root: string;

  constructor(rootPath = env.LOCAL_STORAGE_PATH) {
    if (!rootPath || isAbsolute(rootPath) === false) throw new AppError(500, 'STORAGE_MISCONFIGURED', 'Local storage path must be absolute.');
    this.root = resolve(rootPath);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  private pathFor(key: string) {
    if (!key || key.includes('\0') || isAbsolute(key)) throw new AppError(400, 'STORAGE_KEY_INVALID', 'Storage key is invalid.');
    const target = resolve(this.root, key);
    const relativePath = relative(this.root, target);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new AppError(400, 'STORAGE_KEY_INVALID', 'Storage key is invalid.');
    return target;
  }

  async upload(input: StorageUpload): Promise<StorageObjectResult> {
    const storageKey = `objects/${randomUUID()}`;
    const target = this.pathFor(storageKey);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, input.body, { flag: 'wx', mode: 0o600 });
    return { provider: this.name, storageKey, fileId: storageKey, filename: input.filename, mimeType: input.mimeType, size: input.body.byteLength, checksum: input.checksum };
  }

  async download(_fileId: string, storageKey: string) {
    const target = this.pathFor(storageKey);
    const body = await readFile(target).catch(() => { throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.'); });
    return { body, mimeType: 'application/octet-stream', filename: storageKey.split('/').pop() || 'download' };
  }

  async delete(_fileId: string, storageKey: string) { await unlink(this.pathFor(storageKey)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw new AppError(500, 'STORAGE_DELETE_FAILED', 'Storage deletion failed.'); }); }
  async exists(_fileId: string, storageKey: string) { const target = this.pathFor(storageKey); try { await stat(target); return true; } catch { return false; } }
  async getMetadata(_fileId: string, storageKey: string) { const target = this.pathFor(storageKey); try { return { size: (await stat(target)).size }; } catch { throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.'); } }
  async getSignedUrl(): Promise<string> { throw new AppError(405, 'PRIVATE_DOWNLOAD_ONLY', 'Use the authenticated document download endpoint.'); }

  async createFolder() { const key = `folders/${randomUUID()}`; await mkdir(this.pathFor(key), { recursive: true, mode: 0o700 }); return key; }
  async move(fileId: string, folderId: string) { const source = this.pathFor(fileId); const target = this.pathFor(`${folderId}/${fileId.split('/').pop() || randomUUID()}`); await mkdir(dirname(target), { recursive: true, mode: 0o700 }); await rename(source, target); }
  async copy(fileId: string) { const source = this.pathFor(fileId); const key = `objects/${randomUUID()}`; await copyFile(source, this.pathFor(key)); return key; }
}
