import { Router } from 'express';
import { requireAuth, csrf } from '../middleware/auth.js';
import {
  dashboardController,
  listItems,
  getItem,
  createItemController,
  updateItemController,
  deleteItemController,
  sellItemController,
  warrantyController,
  repairController,
  updateWarrantyController, updateRepairController, removeWarrantyController, removeRepairController, itemActivityController,
} from '../controllers/item.controller.js';
import {
  barcodeController,
  qrController,
  revokeQrController,
  generateQrController, generateBarcodeController,
} from '../controllers/identifier.controller.js';
export const itemRouter = Router();
itemRouter.use(requireAuth);
itemRouter.get('/dashboard', dashboardController);
itemRouter.get('/', listItems);
itemRouter.post('/', csrf, createItemController);
itemRouter.get('/:id', getItem);
itemRouter.patch('/:id', csrf, updateItemController);
itemRouter.delete('/:id', csrf, deleteItemController);
itemRouter.post('/:id/sell', csrf, sellItemController);
itemRouter.post('/:id/warranties', csrf, warrantyController);
itemRouter.post('/:id/repairs', csrf, repairController);
itemRouter.patch('/:id/warranties/:recordId', csrf, updateWarrantyController);
itemRouter.delete('/:id/warranties/:recordId', csrf, removeWarrantyController);
itemRouter.patch('/:id/repairs/:recordId', csrf, updateRepairController);
itemRouter.delete('/:id/repairs/:recordId', csrf, removeRepairController);
itemRouter.get('/:id/activity', itemActivityController);
itemRouter.get('/:id/qr', qrController);
itemRouter.post('/:id/qr', csrf, generateQrController);
itemRouter.delete('/:id/qr', csrf, revokeQrController);
itemRouter.get('/:id/barcode', barcodeController);
itemRouter.post('/:id/barcode', csrf, generateBarcodeController);
