/* global URL, console, process, setTimeout */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { release } from '@ovelo/shared/release';

const root = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const host = '0.0.0.0';
const port = Number.parseInt(process.env.WEB_PORT || '6968', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('WEB_PORT must be a valid TCP port');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split('?')[0] || '/');
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const candidate = resolve(join(root, normalize(decoded).replace(/^[/\\]+/, '')));
  const relativePath = relative(root, candidate);
  if (
    relativePath.startsWith('..') ||
    relativePath.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)
  )
    return null;
  return candidate;
}

function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader(
    'Content-Type',
    contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
  );
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader(
    'Cache-Control',
    file.includes(`${join('dist', 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
  if (response.req.method === 'HEAD') return response.end();
  createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
}

const server = createServer((request, response) => {
  const requested = safeFile(request.url || '/');
  const file =
    requested && existsSync(requested) && statSync(requested).isFile()
      ? requested
      : join(root, 'index.html');
  if (!existsSync(file)) {
    response.statusCode = 503;
    return response.end('Web build is not available.');
  }
  sendFile(response, file);
});

server.on('error', (error) => {
  console.error(JSON.stringify({ service: 'web', code: error.code || 'LISTENER_FAILED', message: 'Web listener failed' }));
  process.exitCode = 1;
});
server.listen(port, host, () => console.info(`Ovelo v${release.version} — ${release.name}: Web running on ${host}:${port}`));
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  void signal;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
