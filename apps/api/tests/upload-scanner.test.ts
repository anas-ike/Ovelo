import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { validateUpload } from '../src/storage/upload-security.js';

async function pdfFixture() {
  const document = new PDFDocument();
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<void>((resolve) => document.on('end', resolve));
  document.text('scanner boundary');
  document.end();
  await complete;
  return Buffer.concat(chunks);
}

describe('PDF scanner fail-closed boundary', () => {
  it('reports scanner unavailability instead of malformed-PDF validation', async () => {
    const previous = process.env.CLAMAV_HOST;
    delete process.env.CLAMAV_HOST;
    try {
      const buffer = await pdfFixture();
      await expect(validateUpload({ buffer, size: buffer.length, originalname: 'valid.pdf' })).rejects.toMatchObject({
        code: 'SCANNER_UNAVAILABLE',
        message: 'PDF scanning is not configured. Contact the administrator.',
      });
    } finally {
      if (previous === undefined) delete process.env.CLAMAV_HOST;
      else process.env.CLAMAV_HOST = previous;
    }
  });
});
