import { Queue } from 'bullmq';
import { prisma } from '../database/prisma.js';
import { queueConnection } from '../config/redis.js';
import { QUEUES } from '@ovelo/shared';
import { AppError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import { redisFailure } from '@ovelo/shared/redis';
export const storageQueue = new Queue(QUEUES.storage, { connection: queueConnection });
storageQueue.on('error', (error) => logger.error({ subsystem: 'storage-queue', code: redisFailure(error) }, 'Queue connection failed'));
export async function enqueueStorageMigration(userId: string | undefined, storageObjectId: string) {
  const object = await prisma.storageObject.findFirst({
    where: { id: storageObjectId, ...(userId ? { userId } : {}), deletedAt: null },
    select: { id: true, provider: true, storageKey: true },
  });
  if (!object) throw new AppError(404, 'STORAGE_OBJECT_NOT_FOUND', 'Storage object not found.');
  if (object.provider === 'BUNNY') return { state: 'MIGRATED' as const, queued: false };
  const existing = await prisma.migrationJob.findFirst({
    where: {
      storageObjectId,
      targetProvider: 'BUNNY',
      state: { in: ['PENDING', 'COPYING', 'VERIFYING'] },
    },
    select: { id: true, state: true },
  });
  if (existing) return { state: existing.state, queued: false };
  const job = await prisma.migrationJob.create({
    data: {
      storageObjectId,
      sourceProvider: object.provider,
      sourceKey: object.storageKey,
      targetProvider: 'BUNNY',
    },
    select: { id: true, state: true },
  });
  await storageQueue.add(
    'migrate-object',
    { migrationJobId: job.id },
    {
      jobId: `migration:${job.id}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    },
  );
  return { state: job.state, queued: true };
}
