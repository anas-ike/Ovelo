import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument, PDFName } from 'pdf-lib';

vi.mock('../src/storage/virus-scanner.js', () => ({ scanFile: vi.fn(async () => undefined) }));
const { validateUpload } = await import('../src/storage/upload-security.js');

async function pdfFixture() {
  const document = new PDFDocument();
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<void>((resolve) => document.on('end', resolve));
  document.text('Ovelo upload test');
  document.end();
  await complete;
  return Buffer.concat(chunks);
}

describe('upload format boundaries', () => {
  it.each([
    ['jpg', 'image/jpeg', () => sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).jpeg().toBuffer()],
    ['jpeg', 'image/jpeg', () => sharp({ create: { width: 4, height: 4, channels: 3, background: 'green' } }).jpeg().toBuffer()],
    ['png', 'image/png', () => sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } }).png().toBuffer()],
    ['webp', 'image/webp', () => sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).webp().toBuffer()],
  ])('accepts a valid %s based on content', async (extension, _mime, make) => {
    const buffer = await make();
    const result = await validateUpload({ buffer, size: buffer.length, originalname: `valid.${extension}` });
    expect(result.mimeType).toBe('image/webp');
  });

  it('accepts a valid PDF when the scanner reports clean', async () => {
    const buffer = await pdfFixture();
    const result = await validateUpload({ buffer, size: buffer.length, originalname: 'valid.pdf' });
    expect(result.mimeType).toBe('application/pdf');
  });

  it('rejects corrupt images with an image-specific error', async () => {
    await expect(validateUpload({ buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3, originalname: 'corrupt.jpg' })).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
  });

  it('rejects malformed PDFs with a PDF-specific error', async () => {
    await expect(validateUpload({ buffer: Buffer.from('%PDF-1.7\nnot-complete'), size: 22, originalname: 'corrupt.pdf' })).rejects.toMatchObject({ code: 'PDF_INVALID' });
  });

  it('rejects PDFs with active content after structural parsing', async () => {
    const document = await PDFLibDocument.load(await pdfFixture());
    document.catalog.set(PDFName.of('OpenAction'), document.context.obj({ S: PDFName.of('JavaScript') }));
    const buffer = Buffer.from(await document.save());
    await expect(validateUpload({ buffer, size: buffer.length, originalname: 'active.pdf' })).rejects.toMatchObject({ code: 'PDF_UNSAFE' });
  });

  it.each(['svg', 'html', 'php', 'exe'])('rejects a disguised %s', async (extension) => {
    await expect(validateUpload({ buffer: Buffer.from('<!doctype html><script>bad()</script>'), size: 38, originalname: `bad.${extension === 'html' ? 'jpg' : extension}` })).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });

  it('rejects oversized input before decoding', async () => {
    await expect(validateUpload({ buffer: Buffer.from('x'), size: 26 * 1024 * 1024, originalname: 'large.jpg' })).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});
