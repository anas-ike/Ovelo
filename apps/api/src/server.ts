import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'Ovelo API listening'));
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
