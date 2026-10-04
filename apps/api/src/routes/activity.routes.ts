import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { activityController } from '../controllers/activity.controller.js';
export const activityRouter = Router();
activityRouter.use(requireAuth);
activityRouter.get('/', activityController);
