# Ovelo SEO and web quality

## Public indexing model

Only these four routes are intentionally indexable:

- `https://ovelo.lightsout.in/`
- `https://ovelo.lightsout.in/how-it-works`
- `https://ovelo.lightsout.in/terms`
- `https://ovelo.lightsout.in/privacy`

`apps/web/public/sitemap.xml` lists exactly those canonical URLs. `apps/web/public/robots.txt` allows the public site, references the sitemap, and disallows authentication, account, private-record, scanning, identifier, administrator, and API paths. Robots directives are discoverability guidance only; API authorization, private sessions, and the administrator web gate remain the security boundary.

The web build generates static HTML for the four public routes using `scripts/generate-public-pages.mjs`. This makes their headings and metadata available to crawlers and social preview fetchers before React runs. The existing React application remains the runtime for navigation and all private functionality. Non-public HTML responses receive `X-Robots-Tag: noindex, nofollow`; the API applies the same header globally. Unknown paths and missing static assets return 404 instead of an SPA soft 404.

## Metadata and canonical strategy

`apps/web/src/seo-pages.json` is the single source for public titles, descriptions, page types, site URL, and sharing image. Public pages use absolute HTTPS canonical URLs without query strings. The React `SeoHead` component keeps client-side navigation aligned with the generated source HTML. Private routes remove public canonical/social metadata and use `noindex, nofollow`.

The homepage includes truthful JSON-LD for `WebSite`, `Organization`, and `SoftwareApplication`. It does not claim reviews, ratings, pricing, social profiles, or other unsupported properties.

## Social previews and images

`apps/web/public/og.svg` is the source artwork and `apps/web/public/og-image.png` is the 1200×630 branded social image used by Open Graph, Twitter/X, and the homepage schema. The site mark remains an SVG favicon. Decorative CSS artwork is not presented as meaningful content and does not expose private records.

## Internal links and URLs

Public headers, footers, CTAs, and the How It Works page link to the existing lowercase, stable public routes. Trailing-slash variants of public information routes redirect permanently to their canonical route. Existing authenticated, QR, admin, OAuth, and API route names are preserved. No user-specific URL is included in public metadata or the sitemap.

## Accessibility and responsive work

Public pages have one meaningful H1, ordered H2/H3 sections, semantic navigation/main/footer landmarks, a skip link, visible keyboard focus rings, descriptive navigation labels, and decorative brand marks hidden from assistive technology. Loading states use a status label; dialogs expose their heading; action buttons expose busy state. Muted text contrast was raised to meet normal-text AA on the dark surfaces.

The public header remains usable at mobile widths rather than hiding every navigation link. Browser checks cover 320, 360, 375, 390, 412, 768, 1024, and desktop widths for public pages.

## Performance work

- Private/authenticated route modules are lazy-loaded; the public entry no longer eagerly bundles every application page.
- Static public HTML avoids waiting for React or private session checks before displaying crawlable content.
- The social image has fixed 1200×630 dimensions and is generated as a compressed PNG from the branded SVG source.
- Google font preconnects and a stylesheet link replace the previous CSS `@import`, allowing the browser to discover the font request earlier. The font stylesheet uses its provider's normal swap behavior.
- Vite output is inspected for route chunks and asset caching remains immutable for hashed assets. The remaining large vendor chunk is recorded for a future dependency-level optimization pass rather than changing behavior speculatively.
- Lab Core Web Vitals require a browser performance tool. Lighthouse is not installed in this repository environment; no Lighthouse score or field INP claim is made.

## Verification status

Implemented and locally verified:

- Static public source HTML, unique titles/descriptions, canonicals, robots directives, Open Graph/Twitter metadata, homepage JSON-LD, one H1, and valid sitemap XML.
- Public/private response classification, 404 behavior, asset status, HTTPS production URL construction, redirect normalization, and API noindex response headers.
- Existing authentication, admin, ownership, upload, QR/barcode, and security tests remain the required regression suite.

Production public checks are repeated after deployment. Search Console is **MANUAL ACTION REQUIRED**: an owner must add `https://ovelo.lightsout.in/` as a property, complete Google’s HTML-tag or DNS verification, then submit `https://ovelo.lightsout.in/sitemap.xml`. No Google credentials or verification token is stored in this repository.

## Future recommendations

1. Run Lighthouse or PageSpeed Insights from a stable region and record mobile/desktop lab results separately.
2. Analyze the remaining vendor chunk before replacing or removing any dependency.
3. Add field performance monitoring only with an approved privacy-preserving analytics decision.
4. Recheck sitemap coverage and Search Console indexing after the next public-content release.
5. Use the accompanying [backlink strategy](backlink-strategy.md) for legitimate, relevant outreach only.
