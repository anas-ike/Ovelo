import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';

const dist = (path) => readFileSync(new URL(`../apps/web/dist/${path}`, import.meta.url), 'utf8');
const publicPages = [
  ['index.html', 'https://ovelo.lightsout.in/', 'Ovelo — Know What You Own'],
  [
    'how-it-works/index.html',
    'https://ovelo.lightsout.in/how-it-works',
    'How Ovelo Works — Track Everything You Own',
  ],
  ['terms/index.html', 'https://ovelo.lightsout.in/terms', 'Terms of Service — Ovelo'],
  ['privacy/index.html', 'https://ovelo.lightsout.in/privacy', 'Privacy Policy — Ovelo'],
];

test('public SEO HTML is generated with unique metadata and one H1', () => {
  for (const [file, canonical, title] of publicPages) {
    const html = dist(file);
    assert.match(
      html,
      new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`),
    );
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}"`));
    assert.match(html, /<meta name="robots" content="index, follow"/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.doesNotMatch(html, /https?:\/\/localhost|http:\/\/ovelo\.lightsout\.in/);
  }
  const homepage = dist('index.html');
  const jsonLd = homepage.match(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(jsonLd);
  const graph = JSON.parse(jsonLd)['@graph'];
  assert.deepEqual(
    graph.map((entry) => entry['@type']),
    ['WebSite', 'Organization', 'SoftwareApplication'],
  );
});

test('sitemap and robots contain only intended public routes', () => {
  const sitemap = dist('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(
    urls,
    publicPages.map(([, canonical]) => canonical),
  );
  assert.ok(
    urls.every((value) => {
      const parsed = new URL(value);
      return (
        parsed.hostname === 'ovelo.lightsout.in' &&
        !parsed.search &&
        !parsed.hash &&
        !/\/(login|admin|api|dashboard|item)(\/|$)/.test(parsed.pathname)
      );
    }),
  );
  const robots = dist('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/ovelo\.lightsout\.in\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/assets/);
});

test('private fallback is explicitly non-indexable', () => {
  assert.equal(existsSync(new URL('../apps/web/dist/private.html', import.meta.url)), true);
  const html = dist('private.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<meta name="googlebot" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /rel="canonical"/);
});
