import { AppError } from '../middleware/error.js';

const hosts = new Set(['google.com', 'www.google.com', 'maps.google.com', 'www.google.co.uk', 'maps.app.goo.gl', 'goo.gl']);
export function validateMapsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.has(url.hostname) ||
      (url.hostname === 'goo.gl' ? !url.pathname.startsWith('/maps/') : url.hostname === 'maps.app.goo.gl' ? !/^\/[\w-]+$/.test(url.pathname) : url.hostname === 'maps.google.com' ? false : !/^\/maps(?:\/|$)/.test(url.pathname))) throw new Error();
    url.hash = '';
    return url;
  } catch { throw new AppError(400, 'MAPS_URL_INVALID', 'Use an HTTPS Google Maps place, search or sharing link.'); }
}
export function parseMapsUrl(value: string) {
  const url = validateMapsUrl(value);
  const pathName = /\/place\/([^/]+)/.exec(url.pathname)?.[1];
  let name: string;
  try { name = (pathName ? decodeURIComponent(pathName.replace(/\+/g, ' ')) : url.searchParams.get('query') || url.searchParams.get('q') || '').slice(0, 100); }
  catch { throw new AppError(400, 'MAPS_URL_INVALID', 'The Maps place name is malformed.'); }
  const precise = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.toString());
  const coords = precise || /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname) || /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('ll') || '');
  const latitude = coords ? Number(coords[1]) : null;
  const longitude = coords ? Number(coords[2]) : null;
  if (latitude !== null && (Math.abs(latitude) > 90 || Math.abs(longitude!) > 180)) throw new AppError(400, 'MAPS_URL_INVALID', 'The coordinates are invalid.');
  return { name, address: name || null, latitude, longitude, mapsUrl: url.toString() };
}
export async function expandMapsUrl(value: string) {
  let url = validateMapsUrl(value);
  if (!['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) return parseMapsUrl(url.toString());
  for (let i = 0; i < 4; i++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) return parseMapsUrl(value); // Valid sharing link; user supplies its label.
    url = validateMapsUrl(new URL(location, url).toString());
    if (!['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) return parseMapsUrl(url.toString());
  }
  throw new AppError(400, 'MAPS_URL_INVALID', 'The sharing link redirects too many times. Paste the full Maps URL instead.');
}
