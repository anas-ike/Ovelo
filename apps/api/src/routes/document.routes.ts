import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { csrf, requireAuth } from '../middleware/auth.js';
import {
  createDocument,
  getDocument,
  removeDocument,
  listDocumentsController,
} from '../controllers/document.controller.js';
import { requireUploadConsent } from '../middleware/policy-consent.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE, files: 1, fields: 10 },
});
export const documentRouter = Router();
documentRouter.use(requireAuth);
documentRouter.get('/documents', listDocumentsController);
documentRouter.get('/items/:id/documents', listDocumentsController);
documentRouter.post(
  '/items/:id/documents',
  csrf,
  requireUploadConsent,
  upload.single('file'),
  createDocument,
);
documentRouter.get('/documents/:documentId/download', getDocument);
documentRouter.delete('/documents/:documentId', csrf, removeDocument);
