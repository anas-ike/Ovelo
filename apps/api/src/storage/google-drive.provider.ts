import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import type { StorageProvider, StorageUpload, StorageObjectResult } from './storage-provider.js';
import { AppError } from '../middleware/error.js';

export class GoogleDriveProvider implements StorageProvider {
  readonly name = 'GOOGLE_DRIVE' as const;
  private token?: { value: string; expires: number };
  constructor() {
    if (
      !env.GOOGLE_DRIVE_CLIENT_ID ||
      !env.GOOGLE_DRIVE_CLIENT_SECRET ||
      !env.GOOGLE_DRIVE_REFRESH_TOKEN ||
      !env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    )
      throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Google Drive storage is not configured.');
  }
  private async request(path: string, init: RequestInit = {}, upload = false) {
    if (!this.token || this.token.expires < Date.now()) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        body: new URLSearchParams({
          client_id: env.GOOGLE_DRIVE_CLIENT_ID!,
          client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET!,
          refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN!,
          grant_type: 'refresh_token',
        }),
      });
      if (!response.ok)
        throw new AppError(502, 'STORAGE_AUTH_FAILED', 'Storage authentication failed.');
      const token = (await response.json()) as { access_token: string; expires_in: number };
      this.token = {
        value: token.access_token,
        expires: Date.now() + (token.expires_in - 60) * 1000,
      };
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.token.value}`);
    const response = await fetch(
      `https://www.googleapis.com/${upload ? 'upload/' : ''}drive/v3/${path}`,
      { ...init, headers, signal: AbortSignal.timeout(120000), redirect: 'error' },
    );
    if (!response.ok && response.status !== 404)
      throw new AppError(502, 'STORAGE_OPERATION_FAILED', 'Storage provider operation failed.');
    return response;
  }
  async upload(input: StorageUpload): Promise<StorageObjectResult> {
    const boundary = randomUUID();
    const name = randomUUID();
    const metadata = JSON.stringify({
      name,
      parents: [env.GOOGLE_DRIVE_ROOT_FOLDER_ID],
      appProperties: { sha256: input.checksum },
    });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
      ),
      input.body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await this.request(
      'files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: new Uint8Array(body),
      },
      true,
    );
    const file = (await response.json()) as { id?: string };
    if (!file.id) throw new AppError(502, 'STORAGE_UPLOAD_FAILED', 'Storage upload failed.');
    return {
      provider: this.name,
      storageKey: file.id,
      fileId: file.id,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.body.length,
      checksum: input.checksum,
    };
  }
  async download(fileId: string) {
    const response = await this.request(`files/${encodeURIComponent(fileId)}?alt=media`);
    if (response.status === 404) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
    return {
      body: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      filename: 'download',
    };
  }
  async delete(fileId: string) {
    await this.request(`files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  }
  async exists(fileId: string) {
    return (await this.request(`files/${encodeURIComponent(fileId)}?fields=id`)).ok;
  }
  async getMetadata(fileId: string) {
    const response = await this.request(
      `files/${encodeURIComponent(fileId)}?fields=size,appProperties`,
    );
    if (!response.ok) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
    const meta = (await response.json()) as { size: string; appProperties?: { sha256?: string } };
    return { size: Number(meta.size), checksum: meta.appProperties?.sha256 };
  }
  async createFolder() {
    const response = await this.request('files?fields=id', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: randomUUID(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [env.GOOGLE_DRIVE_ROOT_FOLDER_ID],
      }),
    });
    return ((await response.json()) as { id: string }).id;
  }
  async move(fileId: string, folderId: string) {
    const current = await this.request(`files/${encodeURIComponent(fileId)}?fields=parents`);
    const { parents } = (await current.json()) as { parents: string[] };
    await this.request(
      `files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(folderId)}&removeParents=${encodeURIComponent(parents.join(','))}`,
      { method: 'PATCH' },
    );
  }
  async copy(fileId: string) {
    const response = await this.request(`files/${encodeURIComponent(fileId)}/copy?fields=id`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: randomUUID() }),
    });
    return ((await response.json()) as { id: string }).id;
  }
  async getSignedUrl(): Promise<string> {
    throw new AppError(
      405,
      'PRIVATE_DOWNLOAD_ONLY',
      'Use the authenticated document download endpoint.',
    );
  }
}
