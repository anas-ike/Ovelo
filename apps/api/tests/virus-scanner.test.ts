import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createConnection } = vi.hoisted(() => ({ createConnection: vi.fn() }));
vi.mock('node:net', () => ({ default: { createConnection } }));
const { scanFile } = await import('../src/storage/virus-scanner.js');
const { env } = await import('../src/config/env.js');

function socketFixture(response: string | null, error?: boolean) {
  const socket = new EventEmitter() as EventEmitter & {
    destroy: ReturnType<typeof vi.fn>;
    setTimeout: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };
  socket.destroy = vi.fn();
  socket.setTimeout = vi.fn();
  socket.write = vi.fn();
  createConnection.mockImplementationOnce(() => {
    queueMicrotask(() => {
      socket.emit(error ? 'error' : 'connect', error ? new Error('connection refused') : undefined);
      if (response !== null) socket.emit('data', Buffer.from(response));
      if (!error) socket.emit('end');
    });
    return socket;
  });
  return socket;
}

describe('ClamAV scanner states', () => {
  beforeEach(() => {
    createConnection.mockReset();
    env.CLAMAV_ENABLED = true;
    env.CLAMAV_HOST = undefined;
    env.CLAMAV_REQUIRED = false;
  });

  it('returns NOT_CONFIGURED without opening a socket', async () => {
    await expect(scanFile(Buffer.from('file'))).resolves.toEqual({ status: 'NOT_CONFIGURED' });
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('returns CLEAN only for an actual ClamAV OK response', async () => {
    env.CLAMAV_HOST = 'clamav.test';
    socketFixture('stream: OK');
    await expect(scanFile(Buffer.from('file'))).resolves.toEqual({ status: 'CLEAN' });
  });

  it('returns INFECTED for a ClamAV FOUND response', async () => {
    env.CLAMAV_HOST = 'clamav.test';
    socketFixture('stream: Eicar-Test-Signature FOUND');
    await expect(scanFile(Buffer.from('file'))).resolves.toEqual({ status: 'INFECTED' });
  });

  it('distinguishes connection failure from an invalid scanner response', async () => {
    env.CLAMAV_HOST = 'clamav.test';
    socketFixture(null, true);
    await expect(scanFile(Buffer.from('file'))).resolves.toEqual({ status: 'UNAVAILABLE' });
    socketFixture('unexpected response');
    await expect(scanFile(Buffer.from('file'))).resolves.toEqual({ status: 'ERROR' });
  });
});
