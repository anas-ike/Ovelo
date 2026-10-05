import { Router } from 'express';
import { requireAuth, csrf } from '../middleware/auth.js';
import { resolveQr, resolveCode } from '../controllers/qr.controller.js';
import { rateLimit } from '../middleware/rate-limit.js';
export const qrRouter = Router();
qrRouter.use(requireAuth);
qrRouter.get('/qr/:code', resolveQr);
qrRouter.post('/codes/resolve', csrf, rateLimit('code-resolve', 60), resolveCode);
