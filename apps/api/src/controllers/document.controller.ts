import type { Request } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../middleware/error.js';
import { validateUpload } from '../storage/upload-security.js';
import { uploadDocument, downloadDocument, deleteDocument } from '../services/document.service.js';
const kinds = new Set([
  'RECEIPT',
  'WARRANTY',
  'MANUAL',
  'REPAIR',
  'INSURANCE',
  'PURCHASE',
  'OTHER',
]);
export const createDocument = asyncHandler(async (req, res) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Select a file to upload.');
  const kind = String(req.body.kind ?? 'OTHER');
  if (!kinds.has(kind))
    throw new AppError(400, 'INVALID_DOCUMENT_KIND', 'Document type is invalid.');
  const title = String(req.body.title ?? file.originalname)
    .trim()
    .slice(0, 200);
  if (!title) throw new AppError(400, 'INVALID_TITLE', 'Document title is required.');
  res.status(201).json({
    data: await uploadDocument(
      req.auth!.userId,
      String(req.params.id),
      { ...(await validateUpload(file)), size: file.size },
      kind as never,
      title,
    ),
  });
});
export const getDocument = asyncHandler(async (req, res) => {
  const document = await downloadDocument(req.auth!.userId, String(req.params.documentId));
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${document.filename.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`,
  );
  res.send(document.body);
});
export const removeDocument = asyncHandler(async (req, res) => {
  await deleteDocument(req.auth!.userId, String(req.params.documentId));
  res.status(204).send();
});
