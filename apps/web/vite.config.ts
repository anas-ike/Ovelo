import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };
const { changelog } = require('../../CHANGELOG.js') as { changelog: { version: string; name: string }[] };
export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, '../../', 'VITE_');
  const base = environment.VITE_API_URL?.replace(/\/+$/, '');
  if (command === 'build' && mode === 'production') {
    let url: URL;
    try { url = new URL(base || ''); } catch { throw new Error('Production build requires an absolute HTTPS VITE_API_URL ending in /api/v1'); }
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/api/v1' || url.search || url.hash || url.username || url.password)
      throw new Error('Production VITE_API_URL must be HTTPS, non-local and contain exactly /api/v1');
  }
  if (changelog[0]?.version !== version) throw new Error('Release metadata mismatch');
  return {
  plugins: [react(), tailwindcss(), { name: 'ovelo-release', transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'ovelo:version', content: version }, injectTo: 'head' },
    { tag: 'meta', attrs: { name: 'ovelo:release', content: changelog[0]!.name }, injectTo: 'head' },
  ] }],
  define: base ? { 'import.meta.env.VITE_API_URL': JSON.stringify(base) } : {},
  envDir: '../../',
  server: { proxy: { '/api': 'http://localhost:4000' } },
  build: { sourcemap: false },
};
});
