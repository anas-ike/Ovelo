import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { csrf, requireAuth } from '../middleware/auth.js';
import { createDocument, getDocument, removeDocument } from '../controllers/document.controller.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE, files: 1, fields: 10 },
});
export const documentRouter = Router();
documentRouter.use(requireAuth);
documentRouter.post('/items/:id/documents', csrf, upload.single('file'), createDocument);
documentRouter.get('/documents/:documentId/download', getDocument);
documentRouter.delete('/documents/:documentId', csrf, removeDocument);
