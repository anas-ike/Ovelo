import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalStorageProvider } from '../src/storage/local-storage.provider.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('local storage provider', () => {
  it('round-trips files using generated keys outside the web root', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ovelo-local-storage-'));
    directories.push(directory);
    const provider = new LocalStorageProvider(directory);
    const result = await provider.upload({
      filename: '../../secret.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('private'),
      checksum: 'checksum',
    });
    expect(result.storageKey).toMatch(/^objects\/[0-9a-f-]+$/);
    expect(await provider.exists(result.fileId, result.storageKey)).toBe(true);
    expect((await provider.download(result.fileId, result.storageKey)).body.toString()).toBe(
      'private',
    );
    expect((await readFile(join(directory, result.storageKey))).toString()).toBe('private');
  });

  it('rejects traversal and absolute storage keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ovelo-local-storage-'));
    directories.push(directory);
    const provider = new LocalStorageProvider(directory);
    await expect(provider.exists('ignored', '../outside')).rejects.toMatchObject({
      code: 'STORAGE_KEY_INVALID',
    });
    await expect(provider.download('ignored', '/etc/passwd')).rejects.toMatchObject({
      code: 'STORAGE_KEY_INVALID',
    });
  });
});
