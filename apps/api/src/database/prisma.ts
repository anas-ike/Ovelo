import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // Request/startup handlers classify failures without logging SQL, parameters or URLs.
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
});
