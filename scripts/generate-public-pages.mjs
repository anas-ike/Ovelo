import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = join(root, 'apps/web');
const dist = join(web, 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const seo = JSON.parse(readFileSync(join(web, 'src/seo-pages.json'), 'utf8'));
const content = JSON.parse(readFileSync(join(web, 'src/public-content.json'), 'utf8'));
const site = seo.site;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const link = (href, label, className = '') =>
  `<a${className ? ` class="${className}"` : ''} href="${href}">${label}</a>`;
const brand = () =>
  '<a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">ovelo</span></a>';
function footer() {
  return `<footer>${brand()}<span>Ovelo — Know what you own.</span><nav aria-label="Footer navigation">${link('/how-it-works', 'How it works')} · ${link('/terms', 'Terms')} · ${link('/privacy', 'Privacy')}</nav><a href="mailto:contact@lightsout.in">Contact Ovelo</a></footer>`;
}
function bodyFor(pathname) {
  if (pathname === '/')
     return `<a class="skip-link" href="#main-content">Skip to content</a><header class="landing-nav">${brand()}<nav aria-label="Public navigation">${link('/how-it-works', 'How it works')}${link('/privacy', 'Privacy')}${link('/terms', 'Terms')}${link('/login', 'Sign in', 'text-link')}${link('/register', 'Get started', 'button button-primary button-small')}</nav></header><main id="main-content"><section class="hero"><div class="hero-copy"><h1>Know what <em>you own.</em></h1><p class="hero-sub">Ovelo brings your things, their details, and the records behind them into one calm, private place.</p><p>Private by design. Yours by default.</p><p>${link('/register', 'Start your inventory', 'button button-primary')} ${link('/how-it-works', 'See how it works', 'button button-ghost')}</p></div></section><section class="feature-section"><div class="section-intro"><h2>The record behind every thing.</h2><p>Receipts and documents are useful. Your ownership record is the foundation.</p></div><div class="feature-grid"><article><h3>Remember the details</h3><p>Serial numbers, locations, value, warranty dates, and repairs stay connected to the thing itself.</p></article><article><h3>Find it in a moment</h3><p>Search your records, scan a code, or browse your spaces as your inventory grows.</p></article><article><h3>Keep the history</h3><p>When something is repaired or moved, the story stays with it.</p></article></div></section></main>${footer()}`;
  const kind = pathname === '/how-it-works' ? 'help' : pathname.slice(1);
  const title =
    kind === 'help' ? 'How Ovelo works' : kind === 'terms' ? 'Terms of Service' : 'Privacy Policy';
     return `<a class="skip-link" href="#main-content">Skip to content</a><header class="landing-nav">${brand()}<nav aria-label="Public navigation">${link('/', 'Home')}${link('/how-it-works', 'How it works')}${link('/terms', 'Terms')}${link('/privacy', 'Privacy')}${link('/login', 'Sign in')}</nav></header><main id="main-content" class="public-info"><div class="section-intro"><h1>${title}</h1><p>${kind === 'help' ? 'A practical guide to keeping the record behind everything you own.' : 'Last updated: 2026-10-06'}</p></div><div class="public-sections">${content[kind].map(([heading, text]) => `<section class="detail-section"><h2>${escape(heading)}</h2><p>${escape(text)}</p></section>`).join('')}</div>${kind === 'help' ? link('/register', 'Create your Ovelo account', 'button button-primary') : ''}</main>${footer()}`;
}
const ld = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'Ovelo', description: site.description, url: site.url },
    { '@type': 'Organization', name: 'Ovelo', url: site.url, logo: site.image },
    {
      '@type': 'SoftwareApplication',
      name: 'Ovelo',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web',
      description: site.description,
      url: site.url,
      image: site.image,
    },
  ],
});
for (const pathname of Object.keys(seo.pages)) {
  const page = seo.pages[pathname];
  const canonical = `${site.url}${pathname === '/' ? '/' : pathname}`;
  const head = `<meta name="description" content="${escape(page.description)}" data-ovelo-seo="true"><meta name="robots" content="index, follow" data-ovelo-seo="true"><link rel="canonical" href="${canonical}" data-ovelo-seo="true"><meta property="og:title" content="${escape(page.title)}" data-ovelo-seo="true"><meta property="og:description" content="${escape(page.description)}" data-ovelo-seo="true"><meta property="og:type" content="${page.type}" data-ovelo-seo="true"><meta property="og:url" content="${canonical}" data-ovelo-seo="true"><meta property="og:site_name" content="Ovelo" data-ovelo-seo="true"><meta property="og:image" content="${site.image}" data-ovelo-seo="true"><meta property="og:image:width" content="1200" data-ovelo-seo="true"><meta property="og:image:height" content="630" data-ovelo-seo="true"><meta name="twitter:card" content="summary_large_image" data-ovelo-seo="true"><meta name="twitter:title" content="${escape(page.title)}" data-ovelo-seo="true"><meta name="twitter:description" content="${escape(page.description)}" data-ovelo-seo="true"><meta name="twitter:image" content="${site.image}" data-ovelo-seo="true">${pathname === '/' ? `<script type="application/ld+json" data-ovelo-seo="true">${ld}</script>` : ''}`;
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/g, '')
    .replace(/<meta name="robots"[^>]*>/g, '')
    .replace('</head>', `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${bodyFor(pathname)}</div>`);
  const output =
    pathname === '/' ? join(dist, 'index.html') : join(dist, pathname.slice(1), 'index.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html);
}
const privateHtml = template
  .replace(/<title>.*?<\/title>/, '<title>Private workspace — Ovelo</title>')
  .replace(
    /<meta name="description"[^>]*>/g,
    '<meta name="description" content="Private Ovelo account area.">',
  )
  .replace(/<meta name="robots"[^>]*>/g, '')
  .replace(
    '</head>',
    '<meta name="robots" content="noindex, nofollow"><meta name="googlebot" content="noindex, nofollow"></head>',
  );
writeFileSync(join(dist, 'private.html'), privateHtml);
const notFound = privateHtml
  .replace('<title>Private workspace — Ovelo</title>', '<title>Page not found — Ovelo</title>')
  .replace(
    '<div id="root"></div>',
    `<div id="root"><div class="landing public-info"><a class="skip-link" href="#main-content">Skip to content</a><header class="landing-nav">${brand()}<nav aria-label="Public navigation">${link('/', 'Home')}${link('/how-it-works', 'How it works')}${link('/login', 'Sign in')}</nav></header><main id="main-content" class="not-found"><span class="eyebrow">OVELO / 404</span><h1>Page not found</h1><p>This page may have moved, or the address may be incorrect.</p><div class="record-actions">${link('/', 'Go home', 'button button-primary')}${link('/dashboard', 'Open my inventory', 'button button-ghost')}</div></main></div></div>`,
  );
writeFileSync(join(dist, '404.html'), notFound);
