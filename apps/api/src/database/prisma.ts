import { PrismaClient } from '@prisma/client';
import { databaseUrl } from '@ovelo/shared/database';
import 'dotenv/config';

export const prisma = new PrismaClient({
  datasourceUrl: databaseUrl(process.env.DATABASE_URL!),
  // Request/startup handlers classify failures without logging SQL, parameters or URLs.
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
});
