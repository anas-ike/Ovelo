import { Worker } from 'bullmq';
import { workerEnv } from './config.js';
import { prisma } from './database.js';
import { logger } from './logger.js';
import { QUEUES } from '@ovelo/shared';
import { processStorageMigration } from './storage-migration.js';
import { redisOptions, redisFailure } from '@ovelo/shared/redis';
import { release } from '@ovelo/shared/release';

const connection = redisOptions(workerEnv.REDIS_URL);
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
    { connection, concurrency: 2, autorun: false },
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
    { connection, concurrency: 2, autorun: false },
  ),
  new Worker(
    QUEUES.email,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Email job received');
    },
    { connection, concurrency: 4, autorun: false },
  ),
  new Worker(
    QUEUES.reports,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Report job received');
    },
    { connection, concurrency: 2, autorun: false },
  ),
];
workers.forEach((worker) => {
  worker.on('error', (error) => logger.error({ subsystem: 'worker-redis', queue: worker.name, code: redisFailure(error) }, 'Worker connection failed'));
  worker.on('failed', (job, error) =>
    logger.error({ jobId: job?.id, errorType: error.name }, 'Background job failed'),
  );
});
let shuttingDown = false;
const shutdown = async (signal: string, code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => { logger.error({ signal }, 'Worker shutdown timed out; unfinished jobs will be recovered by BullMQ'); process.exit(1); }, 10000);
  timer.unref();
  try {
    await Promise.all(workers.map((worker) => worker.close()));
    await prisma.$disconnect();
    clearTimeout(timer);
    process.exitCode = code;
  } catch { logger.error({ signal }, 'Worker shutdown failed'); process.exit(1); }
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
let startupTimer: NodeJS.Timeout | undefined;
try {
  await prisma.$connect();
  await prisma.warranty.findFirst({ select: { id: true } });
  await prisma.migrationJob.findFirst({ select: { id: true } });
} catch {
  logger.fatal({ subsystem: 'database' }, 'Worker database startup check failed; verify connectivity, TLS and migrations');
  await shutdown('DATABASE_STARTUP_FAILURE', 1);
}
if (!shuttingDown) try {
  await Promise.race([
    Promise.all(workers.map((worker) => worker.waitUntilReady())),
    new Promise<never>((_resolve, reject) => { startupTimer = setTimeout(() => reject(new Error('Redis startup timeout')), 10000); }),
  ]);
  if (!shuttingDown) {
    for (const worker of workers) void worker.run().catch((error: unknown) => {
      logger.fatal({ subsystem: 'worker', queue: worker.name, code: redisFailure(error) }, 'Worker stopped unexpectedly');
      void shutdown('WORKER_FAILURE', 1);
    });
    console.info(`Ovelo v${release.version} — ${release.name}: Worker started`);
  }
} catch (error) {
  logger.fatal({ subsystem: 'worker-redis', code: redisFailure(error) }, 'Worker Redis startup failed');
  await shutdown('STARTUP_FAILURE', 1);
} finally { clearTimeout(startupTimer); }
