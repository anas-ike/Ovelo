import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';

const scanFile = vi.fn();
vi.mock('../src/storage/virus-scanner.js', () => ({ scanFile }));
const { validateUpload } = await import('../src/storage/upload-security.js');
const { env } = await import('../src/config/env.js');

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

describe('optional malware scanner boundary', () => {
  beforeEach(() => {
    scanFile.mockReset();
    env.CLAMAV_REQUIRED = false;
  });

  it('accepts a valid PDF when ClamAV is not configured', async () => {
    scanFile.mockResolvedValue({ status: 'NOT_CONFIGURED' });
    const buffer = await pdfFixture();
    const result = await validateUpload({ buffer, size: buffer.length, originalname: 'valid.pdf' });
    expect(result.scannerStatus).toBe('NOT_CONFIGURED');
  });

  it('accepts a valid JPG when the scanner is unavailable without using PDF validation', async () => {
    scanFile.mockResolvedValue({ status: 'UNAVAILABLE' });
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).jpeg().toBuffer();
    const result = await validateUpload({ buffer, size: buffer.length, originalname: 'valid.jpg' });
    expect(result.mimeType).toBe('image/webp');
    expect(result.scannerStatus).toBe('UNAVAILABLE');
  });

  it('accepts a clean scan and preserves the CLEAN state', async () => {
    scanFile.mockResolvedValue({ status: 'CLEAN' });
    const buffer = await pdfFixture();
    const result = await validateUpload({ buffer, size: buffer.length, originalname: 'clean.pdf' });
    expect(result.scannerStatus).toBe('CLEAN');
  });

  it('rejects an infected result without exposing scanner details', async () => {
    scanFile.mockResolvedValue({ status: 'INFECTED' });
    const buffer = await pdfFixture();
    await expect(validateUpload({ buffer, size: buffer.length, originalname: 'infected.pdf' })).rejects.toMatchObject({
      code: 'MALWARE_DETECTED',
      message: 'This file failed security validation.',
    });
  });

  it('accepts optional scanner errors without representing them as CLEAN', async () => {
    scanFile.mockResolvedValue({ status: 'ERROR' });
    const buffer = await pdfFixture();
    const result = await validateUpload({ buffer, size: buffer.length, originalname: 'error.pdf' });
    expect(result.scannerStatus).toBe('ERROR');
  });

  it('fails closed when scanner availability is explicitly required', async () => {
    env.CLAMAV_REQUIRED = true;
    scanFile.mockResolvedValue({ status: 'UNAVAILABLE' });
    const buffer = await pdfFixture();
    await expect(validateUpload({ buffer, size: buffer.length, originalname: 'required.pdf' })).rejects.toMatchObject({
      code: 'SCANNER_UNAVAILABLE',
      message: 'File security scanning is currently unavailable.',
    });
  });
});
