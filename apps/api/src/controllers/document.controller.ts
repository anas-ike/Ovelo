import type { Request } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../middleware/error.js';
import { UploadSecurityError, validateUpload } from '../storage/upload-security.js';
import type { ScannerStatus } from '../storage/virus-scanner.js';
import { uploadDocument, downloadDocument, deleteDocument } from '../services/document.service.js';
import { prisma } from '../database/prisma.js';
import { assertItem } from '../services/item-records.service.js';
import { logger } from '../utils/logger.js';
const kinds = new Set([
  'RECEIPT',
  'WARRANTY',
  'MANUAL',
  'REPAIR',
  'INSURANCE',
  'PURCHASE',
  'OTHER',
]);
async function recordUploadSecurityEvent(userId: string, type: string, requestId: string | undefined) {
  const fields = { userId, requestId, type };
  if (type.includes('REJECTED')) logger.warn(fields, 'Upload security event');
  else logger.info(fields, 'Upload security event');
  await prisma.securityEvent.create({ data: { userId, type } }).catch(() => {
    logger.warn(fields, 'Upload security event could not be recorded');
  });
}
function scannerEventStatus(status: ScannerStatus) {
  return `SCANNER_${status}`;
}
export const createDocument = asyncHandler(async (req, res) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Select a file to upload.');
  await assertItem(req.auth!.userId, String(req.params.id));
  const kind = String(req.body.kind ?? 'OTHER');
  if (!kinds.has(kind))
    throw new AppError(400, 'INVALID_DOCUMENT_KIND', 'Document type is invalid.');
  const title = String(req.body.title ?? file.originalname)
    .trim()
    .slice(0, 200);
  if (!title) throw new AppError(400, 'INVALID_TITLE', 'Document title is required.');
  let validated;
  try {
    validated = await validateUpload(file);
  } catch (error) {
    const type = error instanceof UploadSecurityError
      ? `UPLOAD_REJECTED_${scannerEventStatus(error.scannerStatus)}`
      : 'UPLOAD_REJECTED_VALIDATION_FAILED';
    await recordUploadSecurityEvent(req.auth!.userId, type, res.locals.requestId);
    throw error;
  }
  const document = await uploadDocument(
    req.auth!.userId,
    String(req.params.id),
    validated,
    kind as never,
    title,
  );
  await recordUploadSecurityEvent(
    req.auth!.userId,
    `UPLOAD_ACCEPTED_${scannerEventStatus(validated.scannerStatus)}`,
    res.locals.requestId,
  );
  res.status(201).json({ data: document });
});
export const getDocument = asyncHandler(async (req, res) => {
  const document = await downloadDocument(req.auth!.userId, String(req.params.documentId));
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader(
    'Content-Disposition',
    `${req.query.preview === 'true' && document.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${document.filename.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`,
  );
  res.send(document.body);
});
export const listDocumentsController = asyncHandler(async (req, res) => {
  const itemId = req.params.id ? String(req.params.id) : undefined;
  if (itemId) await assertItem(req.auth!.userId, itemId);
  const documents = await prisma.document.findMany({ where: { itemId, item: { userId: req.auth!.userId, deletedAt: null }, storageObject: { userId: req.auth!.userId, deletedAt: null } },
    select: { id: true, kind: true, title: true, createdAt: true, item: { select: { id: true, name: true } }, storageObject: { select: { filename: true, mimeType: true, size: true } } },
    orderBy: { createdAt: 'desc' }, take: 500 });
  res.json({ data: documents.map(d => ({ ...d, storageObject: { ...d.storageObject, size: d.storageObject.size.toString() } })) });
});
export const removeDocument = asyncHandler(async (req, res) => {
  await deleteDocument(req.auth!.userId, String(req.params.documentId));
  res.status(204).send();
});
