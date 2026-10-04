import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { GoogleDriveProvider } from './google-drive.provider.js';
import { BunnyProvider } from './bunny.provider.js';
import type { StorageProvider, StorageUpload } from './storage-provider.js';
export function providerFor(name?: 'GOOGLE_DRIVE' | 'BUNNY'): StorageProvider {
  if (name === 'BUNNY' || (!name && env.BUNNY_ENABLED)) return new BunnyProvider();
  if (name === 'GOOGLE_DRIVE' || !env.BUNNY_ENABLED) return new GoogleDriveProvider();
  throw new AppError(503, 'STORAGE_UNAVAILABLE', 'No storage provider is configured.');
}
export const checksum = (body: Buffer) => createHash('sha256').update(body).digest('hex');
export async function uploadObject(input: StorageUpload) {
  return providerFor().upload(input);
}
