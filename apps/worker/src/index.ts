import { Worker } from 'bullmq';
import { workerEnv } from './config.js';
import { prisma } from './database.js';
import { logger } from './logger.js';
import { QUEUES } from '@ovelo/shared';
import { processStorageMigration } from './storage-migration.js';

const connection = { url: workerEnv.REDIS_URL };
const workers = [
  new Worker(
    QUEUES.maintenance,
    async (job) => {
      if (job.name === 'warranty-notifications') {
        const now = new Date();
        const soon = new Date(now.getTime() + 90 * 86400000);
        const warranties = await prisma.warranty.findMany({
          where: { endDate: { gte: now, lte: soon }, item: { deletedAt: null } },
          select: { id: true, endDate: true, item: { select: { userId: true, name: true } } },
        });
        for (const warranty of warranties)
          await prisma.notification.upsert({
            where: {
              deduplicationKey: `warranty:${warranty.id}:${warranty.endDate.toISOString().slice(0, 10)}`,
            },
            create: {
              userId: warranty.item.userId,
              deduplicationKey: `warranty:${warranty.id}:${warranty.endDate.toISOString().slice(0, 10)}`,
              title: 'Warranty ending soon',
              body: `${warranty.item.name} has a warranty ending on ${warranty.endDate.toLocaleDateString()}.`,
            },
            update: {},
          });
      }
    },
    { connection, concurrency: 2 },
  ),
  new Worker(
    QUEUES.storage,
    async (job) => {
      if (job.name === 'migrate-object')
        await processStorageMigration(
          String((job.data as { migrationJobId: string }).migrationJobId),
        );
      else logger.warn({ jobId: job.id, name: job.name }, 'Unknown storage job');
    },
    { connection, concurrency: 2 },
  ),
  new Worker(
    QUEUES.email,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Email job received');
    },
    { connection, concurrency: 4 },
  ),
  new Worker(
    QUEUES.reports,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Report job received');
    },
    { connection, concurrency: 2 },
  ),
];
workers.forEach((worker) =>
  worker.on('failed', (job, error) =>
    logger.error({ jobId: job?.id, err: error }, 'Background job failed'),
  ),
);
logger.info({ queues: Object.values(QUEUES) }, 'Ovelo worker started');
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Ovelo worker shutting down');
  await Promise.all(workers.map((worker) => worker.close()));
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
