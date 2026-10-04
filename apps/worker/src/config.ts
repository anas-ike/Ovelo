const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;
if (!redisUrl || !databaseUrl)
  throw new Error('REDIS_URL and DATABASE_URL are required for the worker');
export const workerEnv = { REDIS_URL: redisUrl, DATABASE_URL: databaseUrl };
