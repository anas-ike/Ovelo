// Run with the configured environment after building shared packages.
// Uses short-lived diagnostic keys only; never outputs URLs, credentials or raw errors.
import process from 'node:process';
import console from 'node:console';
import { setTimeout, clearTimeout } from 'node:timers';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { redisOptions, redisFailure } from '../packages/shared/dist/redis.js';

const report = (check, details) => console.info(JSON.stringify({ check, ...details }));
let failed = false;
const deadline = setTimeout(() => { report('connections', { result: 'FAIL', code: 'PROBE_TIMEOUT' }); process.exit(1); }, 30000);
deadline.unref();
if (!process.env.REDIS_URL) {
  failed = true;
  report('redis', { result: 'BLOCKED', reason: 'REDIS_URL absent' });
} else {
  let client;
  let queue;
  let worker;
  try {
    const options = { ...redisOptions(process.env.REDIS_URL), retryStrategy: () => null };
    report('redis-configuration', { hostname: options.host, port: options.port, database: options.db, tls: Boolean(options.tls), sni: options.tls?.servername, certificateVerification: options.tls?.rejectUnauthorized === true });
    client = new Redis({ ...options, lazyConnect: true, maxRetriesPerRequest: 1, commandTimeout: 5000, retryStrategy: () => null });
    client.on('error', () => {}); // Errors are awaited and classified below.
    await client.connect();
    const key = `ovelo:diagnostic:${randomUUID()}`;
    try {
      if (await client.ping() !== 'PONG') throw new Error('PING failed');
      await client.set(key, 'probe', 'EX', 10);
      if (await client.get(key) !== 'probe') throw new Error('GET failed');
      if (await client.eval("local v=redis.call('GET',KEYS[1]); redis.call('DEL',KEYS[1]); return v", 1, key) !== 'probe') throw new Error('EVAL failed');
      await client.del(key);
    } finally { await client.del(key).catch(() => {}); }
    report('redis-commands', { authentication: 'PASS', ping: 'PASS', set: 'PASS', get: 'PASS', del: 'PASS', eval: 'PASS', databaseSelection: 'PASS' });
    // A unique diagnostic queue cannot consume any application jobs.
    const name = `ovelo-diagnostic-${randomUUID()}`;
    queue = new Queue(name, { connection: options });
    worker = new Worker(name, async () => {}, { connection: options, autorun: false });
    queue.on('error', () => {});
    worker.on('error', () => {});
    await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
    const queueClient = await queue.client;
    const workerClient = await worker.client;
    if (queueClient.options.host !== options.host || workerClient.options.host !== options.host) throw new Error('Queue endpoint mismatch');
    await queue.add('connectivity', {}, { removeOnComplete: true, removeOnFail: true });
    await queue.obliterate({ force: true });
    report('bullmq', { queue: 'PASS', worker: 'PASS', explicitEndpoint: true });
  } catch (error) {
    failed = true;
    report('redis', { result: 'FAIL', code: redisFailure(error) });
  } finally {
    await Promise.all([worker?.close(), queue?.close()]);
    client?.disconnect();
  }
}
if (!process.env.DATABASE_URL) {
  failed = true;
  report('postgresql', { result: 'BLOCKED', reason: 'DATABASE_URL absent' });
} else {
  const prisma = new PrismaClient({ log: [] });
  try {
    await prisma.$connect();
    const ssl = await prisma.$queryRaw`SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
    report('postgresql-connection', { connection: 'PASS', tls: ssl[0]?.ssl === true, prisma: 'PASS' });
    for (const model of ['plan', 'user', 'warranty', 'migrationJob']) {
      try {
        await prisma[model].findFirst({ select: { id: true } });
        report('postgresql-query', { model, result: 'PASS' });
      } catch (error) {
        failed = true;
        report('postgresql-query', { model, result: 'FAIL', code: /^P\d{4}$/.test(error?.code || '') ? error.code : 'QUERY_FAILED' });
      }
    }
    const migrations = await prisma.$queryRaw`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS present`;
    report('postgresql-migrations', { registryPresent: migrations[0]?.present === true });
  } catch (error) {
    failed = true;
    const code = /^P\d{4}$/.test(error?.code || '') ? error.code : 'DATABASE_UNAVAILABLE';
    report('postgresql', { result: 'FAIL', code });
  } finally { await prisma.$disconnect(); }
}
clearTimeout(deadline);
process.exitCode = failed ? 1 : 0;
