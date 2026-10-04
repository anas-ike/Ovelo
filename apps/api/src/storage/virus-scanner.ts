import net from 'node:net';
import { AppError } from '../middleware/error.js';
export async function scanFile(body: Buffer) {
  const host = process.env.CLAMAV_HOST;
  if (!host)
    throw new AppError(
      503,
      'SCANNER_UNAVAILABLE',
      'PDF scanning is not configured. Contact the administrator.',
    );
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(process.env.CLAMAV_PORT ?? 3310) });
    let response = '';
    socket.setTimeout(30000, () => socket.destroy(new Error('scanner timeout')));
    socket.on('error', () =>
      reject(new AppError(503, 'SCANNER_UNAVAILABLE', 'File scanning is unavailable.')),
    );
    socket.on('data', (data) => {
      response += data.toString();
      if (response.length > 4096) socket.destroy(new Error('invalid scanner response'));
    });
    socket.on('end', () => {
      if (response.includes('FOUND'))
        reject(new AppError(415, 'MALWARE_DETECTED', 'This file failed the security scan.'));
      else if (response.includes(': OK')) resolve();
      else reject(new AppError(503, 'SCAN_FAILED', 'The security scan could not be completed.'));
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
