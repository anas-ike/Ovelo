import net from 'node:net';
import { env } from '../config/env.js';

export type ScannerStatus = 'CLEAN' | 'INFECTED' | 'UNAVAILABLE' | 'ERROR' | 'NOT_CONFIGURED';
export type ScannerResult = { status: ScannerStatus };

export async function scanFile(body: Buffer): Promise<ScannerResult> {
  if (!env.CLAMAV_ENABLED || !env.CLAMAV_HOST) return { status: 'NOT_CONFIGURED' };
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
    let response = '';
    let settled = false;
    const finish = (result: ScannerResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(30000, () => finish({ status: 'UNAVAILABLE' }));
    socket.on('error', () => finish({ status: 'UNAVAILABLE' }));
    socket.on('data', (data) => {
      response += data.toString();
      if (response.length > 4096) finish({ status: 'ERROR' });
    });
    socket.on('end', () => {
      if (response.includes('FOUND')) finish({ status: 'INFECTED' });
      else if (response.includes(': OK')) finish({ status: 'CLEAN' });
      else finish({ status: 'ERROR' });
    });
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < body.length; offset += 65536) {
        const chunk = body.subarray(offset, offset + 65536);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
