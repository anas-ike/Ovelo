import { createHash } from 'node:crypto';
import { prisma } from './database.js';
import { logger } from './logger.js';
type Provider = 'GOOGLE_DRIVE' | 'BUNNY';
const env = process.env;
async function googleToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error('google-auth-failed');
  return ((await response.json()) as { access_token: string }).access_token;
}
async function readObject(provider: Provider, fileId: string, key: string) {
  if (provider === 'GOOGLE_DRIVE') {
    const token = await googleToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120000) },
    );
    if (!response.ok) throw new Error('source-download-failed');
    return Buffer.from(await response.arrayBuffer());
  }
  const response = await fetch(
    `https://storage.bunnycdn.com/${encodeURIComponent(env.BUNNY_STORAGE_ZONE!)}/${key.split('/').map(encodeURIComponent).join('/')}`,
    { headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! }, signal: AbortSignal.timeout(120000) },
  );
  if (!response.ok) throw new Error('source-download-failed');
  return Buffer.from(await response.arrayBuffer());
}
async function writeBunny(body: Buffer, checksum: string, mimeType: string) {
  const key = `migrations/${checksum}-${Date.now()}`;
  const response = await fetch(
    `https://storage.bunnycdn.com/${encodeURIComponent(env.BUNNY_STORAGE_ZONE!)}/${key}`,
    {
      method: 'PUT',
      headers: { AccessKey: env.BUNNY_STORAGE_API_KEY!, 'Content-Type': mimeType },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!response.ok) throw new Error('destination-upload-failed');
  return key;
}
export async function processStorageMigration(migrationJobId: string) {
  const job = await prisma.migrationJob.findUnique({
    where: { id: migrationJobId },
    select: {
      id: true,
      state: true,
      sourceProvider: true,
      sourceKey: true,
      targetProvider: true,
      storageObjectId: true,
      storageObject: { select: { fileId: true, mimeType: true, size: true, checksum: true } },
    },
  });
  if (!job || job.state === 'MIGRATED') return;
  if (job.targetProvider !== 'BUNNY' || env.BUNNY_ENABLED !== 'true')
    throw new Error('bunny-not-configured');
  await prisma.migrationJob.update({
    where: { id: job.id },
    data: { state: 'COPYING', attempts: { increment: 1 } },
  });
  try {
    const body = await readObject(job.sourceProvider, job.storageObject.fileId, job.sourceKey);
    const digest = createHash('sha256').update(body).digest('hex');
    if (body.length !== Number(job.storageObject.size) || digest !== job.storageObject.checksum)
      throw new Error('source-verification-failed');
    const targetKey = await writeBunny(body, digest, job.storageObject.mimeType);
    await prisma.migrationJob.update({
      where: { id: job.id },
      data: { state: 'VERIFYING', targetKey },
    });
    const verifyResponse = await fetch(
      `https://storage.bunnycdn.com/${encodeURIComponent(env.BUNNY_STORAGE_ZONE!)}/${targetKey}`,
      { headers: { AccessKey: env.BUNNY_STORAGE_API_KEY! }, signal: AbortSignal.timeout(120000) },
    );
    const verifiedBody = Buffer.from(await verifyResponse.arrayBuffer());
    const verifiedDigest = createHash('sha256').update(verifiedBody).digest('hex');
    if (!verifyResponse.ok || verifiedBody.length !== body.length || verifiedDigest !== digest)
      throw new Error('destination-verification-failed');
    await prisma.$transaction([
      prisma.storageObject.update({
        where: { id: job.storageObjectId },
        data: { provider: 'BUNNY', storageKey: targetKey, fileId: targetKey },
      }),
      prisma.migrationJob.update({
        where: { id: job.id },
        data: { state: 'MIGRATED', verifiedAt: new Date() },
      }),
    ]);
  } catch (error) {
    await prisma.migrationJob.update({
      where: { id: job.id },
      data: {
        state: 'FAILED',
        errorCode: error instanceof Error ? error.message.slice(0, 100) : 'unknown',
      },
    });
    logger.error({ migrationJobId, err: error }, 'Storage migration failed');
    throw error;
  }
}
