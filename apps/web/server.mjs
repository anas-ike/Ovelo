/* global URL, console, process, setTimeout, fetch, AbortSignal */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { release } from '@ovelo/shared/release';
import { createHmac } from 'node:crypto';

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
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
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

function sendFile(response, file, status = 200) {
  response.statusCode = status;
  response.setHeader(
    'Content-Type',
    contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
  );
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader(
    'Cache-Control',
    response.getHeader('Cache-Control') === 'no-store'
      ? 'no-store'
      : file.includes(`${join('dist', 'assets')}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
  );
  if (response.req.method === 'HEAD') return response.end();
  createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
}

const server = createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'https://ovelo.invalid').pathname);
  } catch {
    response.statusCode = 400;
    return response.end('Invalid request.');
  }
  const publicPages = new Set(['/', '/how-it-works', '/terms', '/privacy']);
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  if (process.env.NODE_ENV === 'production')
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (!publicPages.has(pathname) && !extname(pathname)) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('Cache-Control', 'no-store');
  }
  const publicRedirects = new Map([
    ['/how-it-works/', '/how-it-works'],
    ['/terms/', '/terms'],
    ['/privacy/', '/privacy'],
  ]);
  if (publicRedirects.has(pathname)) {
    response.writeHead(308, { Location: publicRedirects.get(pathname) });
    return response.end();
  }
  if (
    (/^\/admin(?:\/|$)/.test(pathname) &&
      !['/admin/login', '/admin/forgot-password', '/admin/reset-password'].includes(pathname)) ||
    /^\/assets\/AdminPage-/.test(pathname)
  ) {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const action = pathname === '/admin/entry' ? 'redeem' : 'validate';
      const value =
        action === 'redeem'
          ? new URL(request.url, 'https://ovelo.invalid').searchParams.get('ticket')
          : (request.headers.cookie || '')
              .split(';')
              .map((c) => c.trim())
              .find((c) => c.startsWith('ovelo_admin_gate='))
              ?.split('=')[1];
      if (!value || !/^[a-f0-9]{64}$/.test(value)) {
        response.writeHead(302, { Location: '/admin/login' });
        return response.end();
      }
      const target = new URL(`/api/v1/admin/gate/${action}`, process.env.API_URL);
      const signature = createHmac('sha256', process.env.SESSION_SECRET)
        .update(`admin-gate:${action}:${value}`)
        .digest('hex');
      const verification = await fetch(target, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ovelo-gate-signature': signature },
        body: JSON.stringify({ value }),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (verification.status === 401 || verification.status === 403) {
        response.writeHead(302, { Location: '/admin/login' });
        return response.end();
      }
      if (!verification.ok) {
        response.statusCode = 503;
        return response.end('Administrator authentication is temporarily unavailable.');
      }
      const result = await verification.json();
      if (action === 'redeem') {
        response.setHeader(
          'Set-Cookie',
          `ovelo_admin_gate=${result.data.gate}; HttpOnly; Path=/; SameSite=Lax; Max-Age=7200${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`,
        );
        response.writeHead(302, { Location: '/admin', 'Referrer-Policy': 'no-referrer' });
        return response.end();
      }
      if (result?.data?.authenticated !== true) {
        response.writeHead(302, { Location: '/admin/login' });
        return response.end();
      }
    } catch {
      response.statusCode = 503;
      return response.end('Administrator authentication is temporarily unavailable.');
    }
  }
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  const htmlRequest =
    ['GET', 'HEAD'].includes(request.method) && (pathname === '/' || !extname(pathname));
  if (htmlRequest)
    response.setHeader(
      'X-Robots-Tag',
      publicPages.has(pathname) ? 'index, follow' : 'noindex, nofollow',
    );
  if (htmlRequest && !publicPages.has(pathname)) response.setHeader('Cache-Control', 'no-store');
  const requested = safeFile(request.url || '/');
  const knownAppRoute =
    publicPages.has(pathname) ||
    [
      '/login',
      '/register',
      '/auth/complete',
      '/consent',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/dashboard',
      '/inventory',
      '/add-item',
      '/activity',
      '/locations',
      '/documents',
      '/containers',
      '/warranties',
      '/reports',
      '/search',
      '/notifications',
      '/settings',
      '/scan',
      '/admin',
      '/admin/login',
      '/admin/forgot-password',
      '/admin/reset-password',
    ].includes(pathname) ||
    /^\/item\/[^/]+(?:\/edit)?$/.test(pathname) ||
    /^\/i\/[^/]+$/.test(pathname) ||
    /^\/admin\//.test(pathname);
  const publicPage =
    publicPages.has(pathname) && pathname !== '/'
      ? join(root, pathname.slice(1), 'index.html')
      : null;
  if (pathname !== '/' && !knownAppRoute && !extname(pathname)) {
    if (existsSync(join(root, '404.html'))) return sendFile(response, join(root, '404.html'), 404);
    response.statusCode = 404;
    return response.end('Not found.');
  }
  if (
    extname(pathname) &&
    (!requested || !existsSync(requested) || !statSync(requested).isFile())
  ) {
    response.statusCode = 404;
    return response.end('Not found.');
  }
  const file =
    publicPage && existsSync(publicPage)
      ? publicPage
      : !publicPages.has(pathname) && knownAppRoute && existsSync(join(root, 'private.html'))
        ? join(root, 'private.html')
        : requested && existsSync(requested) && statSync(requested).isFile()
          ? requested
          : join(root, 'index.html');
  if (!existsSync(file)) {
    response.statusCode = 503;
    return response.end('Web build is not available.');
  }
  sendFile(response, file);
});

server.on('error', (error) => {
  console.error(
    JSON.stringify({
      service: 'web',
      code: error.code || 'LISTENER_FAILED',
      message: 'Web listener failed',
    }),
  );
  process.exitCode = 1;
});
server.listen(port, host, () =>
  console.info(`Ovelo v${release.version} — ${release.name}: Web running on ${host}:${port}`),
);
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
