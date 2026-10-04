import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';
import { providerFor } from './storage/storage-manager.js';
if (env.STORAGE_PROVIDER === 'local') providerFor('LOCAL');
const server = app.listen(env.PORT, '0.0.0.0', () =>
  logger.info(
    { host: '0.0.0.0', port: env.PORT, storageProvider: env.STORAGE_PROVIDER },
    'Ovelo API started',
  ),
);
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
