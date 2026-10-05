import type { Request } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../middleware/error.js';
import { validateUpload } from '../storage/upload-security.js';
import { uploadDocument, downloadDocument, deleteDocument } from '../services/document.service.js';
import { prisma } from '../database/prisma.js';
import { assertItem } from '../services/item-records.service.js';
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
  await assertItem(req.auth!.userId, String(req.params.id));
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
      await validateUpload(file),
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
