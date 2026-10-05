/** Preserve the configured endpoint/TLS/credentials; bound slow external handshakes. */
export function databaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error();
    // Prisma defaults to five seconds. Observed external handshakes exceed that.
    // Explicit operator-supplied timeout parameters always take precedence.
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
    return url.toString();
  } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL'); }
}
