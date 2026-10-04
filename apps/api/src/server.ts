import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';
import { providerFor } from './storage/storage-manager.js';
import { closeSecurityRedis, verifySecurityRedis } from './config/redis.js';
import { storageQueue } from './services/migration.service.js';
import { redisFailure } from '@ovelo/shared/redis';
import type { Server } from 'node:http';
import { release } from '@ovelo/shared/release';

let server: Server | undefined;
let stopping = false;
async function shutdown(signal: string, code = 0) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => { logger.error({ signal }, 'API shutdown timed out'); process.exit(1); }, 10000);
  deadline.unref();
  try {
    if (server?.listening) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await Promise.all([storageQueue.close(), closeSecurityRedis(), prisma.$disconnect()]);
    clearTimeout(deadline);
    process.exitCode = code;
  } catch { logger.error({ signal }, 'API shutdown failed'); process.exit(1); }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await verifySecurityRedis();
} catch (error) {
  logger.fatal({ subsystem: 'security-redis', code: redisFailure(error) }, 'Security Redis startup check failed; check authentication, TLS, connectivity and EVAL/GET/SET/DEL/INCR/PEXPIRE/PTTL permissions');
  await shutdown('STARTUP_FAILURE', 1);
}
if (!stopping) {
  try {
    await prisma.$connect();
    await prisma.plan.findUniqueOrThrow({ where: { code: 'FREE' }, select: { id: true } });
  } catch {
    logger.fatal({ subsystem: 'database' }, 'Database startup check failed; verify connectivity, TLS, migrations and initial plans');
    await shutdown('DATABASE_STARTUP_FAILURE', 1);
  }
}
if (!stopping) {
  if (env.STORAGE_PROVIDER === 'local') providerFor('LOCAL');
  server = app.listen(env.PORT, '0.0.0.0', () => {
    console.info(`Ovelo v${release.version} — ${release.name}: API running on 0.0.0.0:${env.PORT}`);
    console.info(`[Ovelo] Storage: ${env.STORAGE_PROVIDER}`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => { logger.fatal({ code: error.code }, 'API listener failed'); void shutdown('LISTENER_FAILURE', 1); });
}
