import sharp from 'sharp';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { checksum } from './storage-manager.js';
import { scanFile } from './virus-scanner.js';

export async function validateUpload(file: { buffer: Buffer; originalname: string; size: number }) {
  const size = file.buffer.length;
  if (size > env.MAX_UPLOAD_SIZE || file.size > env.MAX_UPLOAD_SIZE)
    throw new AppError(413, 'FILE_TOO_LARGE', 'This file exceeds the upload limit.');
  const unsafeName =
    file.originalname.includes('/') ||
    file.originalname.includes('\\') ||
    [...file.originalname].some((character) => character.charCodeAt(0) < 32);
  if (
    unsafeName ||
    !/^[^.].*\.(jpe?g|png|webp|pdf)$/i.test(file.originalname) ||
    /\.(exe|js|php|html?|svg|sh|bat|com)(\.|$)/i.test(file.originalname)
  )
    throw new AppError(
      415,
      'FILE_TYPE_NOT_ALLOWED',
      'Choose a JPG, PNG, WEBP, or PDF with a safe filename.',
    );
  const b = file.buffer;
  const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  const pdf = b.subarray(0, 5).toString() === '%PDF-';
  if (!png && !jpg && !webp && !pdf)
    throw new AppError(
      415,
      'FILE_TYPE_NOT_ALLOWED',
      'Only JPG, PNG, WEBP, and PDF files are supported.',
    );
  if (size > (pdf ? env.MAX_DOCUMENT_SIZE : env.MAX_IMAGE_SIZE))
    throw new AppError(413, 'FILE_TOO_LARGE', 'This file exceeds the limit for its type.');
  let body: Buffer;
  let mimeType: string;
  if (pdf) {
    // PDFs remain attachments and require a live malware scanner. Fail closed if absent.
    if (
      !b.subarray(-1024).includes(Buffer.from('%%EOF')) ||
      /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/.test(
        b.toString('latin1'),
      )
    )
      throw new AppError(415, 'PDF_UNSAFE', 'Active or malformed PDFs are not accepted.');
    await scanFile(b);
    body = b;
    mimeType = 'application/pdf';
  } else {
    try {
      body = await sharp(b, { limitInputPixels: 40000000, failOn: 'warning', animated: false })
        .rotate()
        .resize({ width: 8000, height: 8000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();
      mimeType = 'image/webp';
    } catch {
      throw new AppError(415, 'IMAGE_INVALID', 'The image could not be safely decoded.');
    }
  }
  if (body.length > env.MAX_UPLOAD_SIZE)
    throw new AppError(413, 'FILE_TOO_LARGE', 'The processed file exceeds the upload limit.');
  return {
    filename: file.originalname.slice(0, 150),
    mimeType,
    body,
    checksum: checksum(body),
    size: body.length,
  };
}
