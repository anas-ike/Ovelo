import { asyncHandler } from '../utils/async-handler.js';
import { getBarcode, getQr, revokeQr } from '../services/identifier.service.js';
export const qrController = asyncHandler(async (req, res) => {
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const result = await getQr(req.auth!.userId, String(req.params.id), format);
  res.type(result.contentType).send(result.body);
});
export const revokeQrController = asyncHandler(async (req, res) => {
  await revokeQr(req.auth!.userId, String(req.params.id));
  res.status(204).send();
});
export const barcodeController = asyncHandler(async (req, res) => {
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const result = await getBarcode(req.auth!.userId, String(req.params.id), format);
  res.type(result.contentType).send(result.body);
});
