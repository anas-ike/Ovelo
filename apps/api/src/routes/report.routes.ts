import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { propertyReport } from '../controllers/report.controller.js';
export const reportRouter = Router();
reportRouter.use(requireAuth);
reportRouter.get('/property.pdf', propertyReport);
