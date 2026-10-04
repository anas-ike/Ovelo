import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
export const resolveQr = asyncHandler(async (req, res) => {
  const code = String(req.params.code);
  if (!/^[a-f0-9]{36}$/.test(code)) throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found.');
  const qr = await prisma.qrCode.findFirst({
    where: { code, revokedAt: null, item: { userId: req.auth!.userId, deletedAt: null } },
    select: { itemId: true },
  });
  if (!qr) throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found.');
  res.json({ data: { itemId: qr.itemId } });
});
