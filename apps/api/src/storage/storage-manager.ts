import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { GoogleDriveProvider } from './google-drive.provider.js';
import { BunnyProvider } from './bunny.provider.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import type { StorageProvider, StorageUpload } from './storage-provider.js';
export type StorageProviderName = 'LOCAL' | 'GOOGLE_DRIVE' | 'BUNNY';
export function providerFor(name?: StorageProviderName): StorageProvider {
  const selected = name ?? (env.STORAGE_PROVIDER === 'local' ? 'LOCAL' : env.STORAGE_PROVIDER === 'google-drive' ? 'GOOGLE_DRIVE' : 'BUNNY');
  if (selected === 'LOCAL') return new LocalStorageProvider();
  if (selected === 'BUNNY') return new BunnyProvider();
  if (selected === 'GOOGLE_DRIVE') return new GoogleDriveProvider();
  throw new AppError(503, 'STORAGE_UNAVAILABLE', 'No storage provider is configured.');
}
export const checksum = (body: Buffer) => createHash('sha256').update(body).digest('hex');
export async function uploadObject(input: StorageUpload) {
  return providerFor().upload(input);
}
