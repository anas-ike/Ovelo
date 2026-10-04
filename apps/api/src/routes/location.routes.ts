import { Router } from 'express';
import { csrf, requireAuth } from '../middleware/auth.js';
import {
  locationsController,
  createLocationController,
  deleteLocationController,
  categoriesController,
  createCategoryController,
  containersController,
  createContainerController,
} from '../controllers/location.controller.js';
export const locationRouter = Router();
locationRouter.use(requireAuth);
locationRouter.get('/categories', categoriesController);
locationRouter.post('/categories', csrf, createCategoryController);
locationRouter.get('/locations', locationsController);
locationRouter.post('/locations', csrf, createLocationController);
locationRouter.delete('/locations/:id', csrf, deleteLocationController);
locationRouter.get('/containers', containersController);
locationRouter.post('/containers', csrf, createContainerController);
