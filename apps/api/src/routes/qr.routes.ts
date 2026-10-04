import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveQr } from '../controllers/qr.controller.js';
export const qrRouter = Router();
qrRouter.use(requireAuth);
qrRouter.get('/qr/:code', resolveQr);
