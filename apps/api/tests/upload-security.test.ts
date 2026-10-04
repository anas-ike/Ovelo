import { describe, expect, it } from 'vitest';
import { validateUpload } from '../src/storage/upload-security.js';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('upload security', () => {
  it('accepts a real PNG by signature and safely re-encodes it', async () => {
    const result = await validateUpload({
      buffer: onePixelPng,
      size: onePixelPng.byteLength,
      originalname: 'receipt.jpg',
    });
    expect(result.mimeType).toBe('image/webp');
  });
  it('rejects HTML even when named as a PDF', async () => {
    await expect(
      validateUpload({
        buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
        size: 38,
        originalname: 'receipt.pdf',
      }),
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });
  it('rejects unsupported executable signatures', async () => {
    await expect(
      validateUpload({
        buffer: Buffer.from('MZ\x90\x00'),
        size: 4,
        originalname: 'invoice.pdf.exe',
      }),
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });
});
