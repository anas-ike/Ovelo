import { isIP } from 'node:net';

/** One parser for security Redis and BullMQ; credentials stay server-side. */
export function redisOptions(value: string) {
  try {
    const url = new URL(value);
    const db = Number(url.pathname.slice(1) || 0);
    const port = Number(url.port || 6379);
    if (!['redis:', 'rediss:'].includes(url.protocol) || !url.hostname || !Number.isInteger(db) || db < 0 || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    const host = url.hostname.replace(/^\[|\]$/g, '');
    return { host, port, db, username: decodeURIComponent(url.username) || undefined, password: decodeURIComponent(url.password) || undefined, connectTimeout: 5000, ...(url.protocol === 'rediss:' ? { tls: { rejectUnauthorized: true, ...(isIP(host) ? {} : { servername: host }) } } : {}) };
  } catch { throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL with a numeric database index'); }
}

/** Never log Redis Error objects: command arguments can contain credentials/state. */
export function redisFailure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const code = (error as { code?: unknown } | null)?.code;
  if (['REDIS_AUTH_FAILED','REDIS_ACL_DENIED','REDIS_TLS_FAILED','REDIS_COMMAND_UNSUPPORTED','REDIS_TIMEOUT'].includes(message)) return message;
  if (/WRONGPASS|NOAUTH|invalid username-password/i.test(message)) return 'REDIS_AUTH_FAILED';
  if (/NOPERM/i.test(message)) return 'REDIS_ACL_DENIED';
  if (/certificate|TLS|SSL|self.signed/i.test(message)) return 'REDIS_TLS_FAILED';
  if (/unknown command/i.test(message)) return 'REDIS_COMMAND_UNSUPPORTED';
  if (['ECONNREFUSED','ECONNRESET','ENOTFOUND','EAI_AGAIN','ETIMEDOUT'].includes(String(code))) return String(code);
  if (/timeout/i.test(message)) return 'REDIS_TIMEOUT';
  return 'REDIS_UNAVAILABLE';
}
