import { asyncHandler } from '../utils/async-handler.js';
import { getBarcode, getQr, revokeQr, generateIdentifier } from '../services/identifier.service.js';
import { z } from 'zod';
export const generateQrController = asyncHandler(async (req, res) => res.status(201).json({ data: await generateIdentifier(req.auth!.userId, String(req.params.id), 'qr', z.object({ expiresAt: z.string().datetime().nullish() }).strict().parse(req.body).expiresAt) }));
export const generateBarcodeController = asyncHandler(async (req, res) => res.status(201).json({ data: await generateIdentifier(req.auth!.userId, String(req.params.id), 'barcode', z.object({ expiresAt: z.string().datetime().nullish() }).strict().parse(req.body).expiresAt) }));
export const qrController = asyncHandler(async (req, res) => {
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const result = await getQr(req.auth!.userId, String(req.params.id), format);
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="ovelo-qr.${format}"`);
  res.type(result.contentType).send(result.body);
});
export const revokeQrController = asyncHandler(async (req, res) => {
  await revokeQr(req.auth!.userId, String(req.params.id));
  res.status(204).send();
});
export const barcodeController = asyncHandler(async (req, res) => {
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const result = await getBarcode(req.auth!.userId, String(req.params.id), format);
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="ovelo-barcode.${format}"`);
  res.type(result.contentType).send(result.body);
});
