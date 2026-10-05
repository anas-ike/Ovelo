import { describe, expect, it } from 'vitest';
import { databaseUrl } from '@ovelo/shared/database';

describe('external database connection defaults', () => {
  it('adds a bounded handshake timeout while preserving configured TLS and URL fields', () => {
    const input = new URL('postgresql://example:example@database.example.com:5432/ovelo?sslmode=require&schema=public');
    const result = new URL(databaseUrl(input.toString()));
    expect(result.searchParams.get('connect_timeout')).toBe('15');
    result.searchParams.delete('connect_timeout');
    expect(result.toString()).toBe(input.toString());
  });
  it('preserves explicit operator timeouts and sanitizes invalid URLs', () => {
    expect(new URL(databaseUrl('postgresql://database.example.com/ovelo?connect_timeout=20')).searchParams.get('connect_timeout')).toBe('20');
    expect(() => databaseUrl('https://example:example@database.example.com')).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
  });
});
