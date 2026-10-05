import pages from '../seo-pages.json';

export const SITE_URL = pages.site.url;
export const SEO_IMAGE = pages.site.image;
export const PUBLIC_PATHS = Object.keys(pages.pages) as Array<keyof typeof pages.pages>;
export type PublicPath = (typeof PUBLIC_PATHS)[number];
export type SeoPage = (typeof pages.pages)[PublicPath];

export function pageSeo(pathname: string): SeoPage | undefined {
  return pages.pages[pathname as PublicPath];
}

export function canonicalFor(pathname: string) {
  return `${SITE_URL}${pathname === '/' ? '/' : pathname}`;
}

export function privateSeo(pathname: string) {
  const label = pathname.startsWith('/admin')
    ? 'Administrator console'
    : pathname === '/login'
      ? 'Sign in'
      : 'Private workspace';
  return {
    title: `${label} — Ovelo`,
    description: 'Private Ovelo account area.',
  };
}
