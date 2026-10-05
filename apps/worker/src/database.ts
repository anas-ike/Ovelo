import { PrismaClient } from '@prisma/client';
import { databaseUrl } from '@ovelo/shared/database';
import { workerEnv } from './config.js';
export const prisma = new PrismaClient({ log: [], datasourceUrl: databaseUrl(workerEnv.DATABASE_URL) });
