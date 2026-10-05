import { describe, expect, it } from 'vitest';
import { parseMapsUrl, validateMapsUrl } from '../src/services/maps.service.js';
import { warrantySchema } from '@ovelo/validation';
describe('Maps input and warranty dates', () => {
  it('parses only allowlisted Maps formats and bounded coordinates', () => {
    expect(parseMapsUrl('https://www.google.com/maps/place/Office+Park/@29.3,47.9,15z')).toMatchObject({ name: 'Office Park', latitude: 29.3, longitude: 47.9 });
    expect(parseMapsUrl('https://maps.google.com/?q=29.3,47.9')).toMatchObject({ latitude: 29.3, longitude: 47.9 });
    expect(validateMapsUrl('https://maps.app.goo.gl/Abc123').hostname).toBe('maps.app.goo.gl');
    for (const url of ['https://google.com.attacker.example/maps', 'http://www.google.com/maps', 'https://example:example@www.google.com/maps', 'https://127.0.0.1/maps', 'https://www.google.com/search?q=maps', 'https://www.google.com/maps/@91,181,5z']) expect(() => parseMapsUrl(url)).toThrow();
  });
  it('compares warranty dates chronologically across offsets', () => {
    expect(warrantySchema.safeParse({ startDate: '2026-10-05T12:00:00+03:00', endDate: '2026-10-05T10:00:00+00:00' }).success).toBe(true);
    expect(warrantySchema.safeParse({ startDate: '2026-10-05T12:00:00+00:00', endDate: '2026-10-05T13:00:00+03:00' }).success).toBe(false);
  });
});
