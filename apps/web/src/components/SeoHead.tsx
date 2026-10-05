import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalFor, pageSeo, privateSeo, SEO_IMAGE, SITE_URL } from '../lib/seo';
import pages from '../seo-pages.json';

const managed = '[data-ovelo-seo]';

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]${managed}`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    tag.setAttribute('data-ovelo-seo', 'true');
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${managed}`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    tag.setAttribute('data-ovelo-seo', 'true');
    document.head.appendChild(tag);
  }
  tag.href = href;
}

function removeManaged(selector: string) {
  document.head.querySelectorAll(selector).forEach((node) => node.remove());
}

export function SeoHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = pageSeo(pathname);
    const details = page || privateSeo(pathname);
    const indexable = Boolean(page);
    document.title = details.title;
    setMeta('name', 'description', details.description);
    setMeta('name', 'robots', indexable ? 'index, follow' : 'noindex, nofollow');
    if (page) {
      const canonical = canonicalFor(pathname);
      setLink('canonical', canonical);
      setMeta('property', 'og:title', details.title);
      setMeta('property', 'og:description', details.description);
      setMeta('property', 'og:type', page.type);
      setMeta('property', 'og:url', canonical);
      setMeta('property', 'og:site_name', 'Ovelo');
      setMeta('property', 'og:image', SEO_IMAGE);
      setMeta('property', 'og:image:width', '1200');
      setMeta('property', 'og:image:height', '630');
      setMeta('name', 'twitter:card', 'summary_large_image');
      setMeta('name', 'twitter:title', details.title);
      setMeta('name', 'twitter:description', details.description);
      setMeta('name', 'twitter:image', SEO_IMAGE);
      if (pathname === '/') {
        let script = document.head.querySelector<HTMLScriptElement>(
          `script[type="application/ld+json"]${managed}`,
        );
        if (!script) {
          script = document.createElement('script');
          script.type = 'application/ld+json';
          script.setAttribute('data-ovelo-seo', 'true');
          document.head.appendChild(script);
        }
        script.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: 'Ovelo',
              description: pages.site.description,
              url: SITE_URL,
            },
            { '@type': 'Organization', name: 'Ovelo', url: SITE_URL, logo: SEO_IMAGE },
            {
              '@type': 'SoftwareApplication',
              name: 'Ovelo',
              applicationCategory: 'ProductivityApplication',
              operatingSystem: 'Web',
              description: pages.site.description,
              url: SITE_URL,
              image: SEO_IMAGE,
            },
          ],
        });
      } else {
        removeManaged(`script[type="application/ld+json"]${managed}`);
      }
    } else {
      removeManaged(
        `link[rel="canonical"]${managed}, meta[property^="og:"]${managed}, meta[name^="twitter:"]${managed}, script[type="application/ld+json"]${managed}`,
      );
    }
  }, [pathname]);
  return null;
}
