import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import { prisma } from '../database/prisma.js';
import { randomToken } from '../utils/crypto.js';
import { AppError } from '../middleware/error.js';
import { assertFeature } from './plan.service.js';
import { findItem } from '../repositories/item.repository.js';
import { env } from '../config/env.js';
export async function getQr(userId: string, itemId: string, format: 'png' | 'svg') {
  await assertFeature(userId, 'qr');
  const item = await findItem(userId, itemId);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  let qr = await prisma.qrCode.findUnique({
    where: { itemId },
    select: { code: true, revokedAt: true },
  });
  if (!qr || qr.revokedAt)
    qr = await prisma.qrCode.upsert({
      where: { itemId },
      create: { itemId, code: randomToken(18) },
      update: { code: randomToken(18), revokedAt: null },
      select: { code: true, revokedAt: true },
    });
  const value = `${env.APP_URL}/i/${qr.code}`;
  if (format === 'svg')
    return {
      contentType: 'image/svg+xml',
      body: Buffer.from(
        await QRCode.toString(value, {
          type: 'svg',
          margin: 1,
          color: { dark: '#151719', light: '#ffffff' },
        }),
      ),
    };
  return {
    contentType: 'image/png',
    body: await QRCode.toBuffer(value, {
      type: 'png',
      margin: 1,
      width: 720,
      color: { dark: '#151719', light: '#ffffff' },
    }),
  };
}
export async function revokeQr(userId: string, itemId: string) {
  await assertFeature(userId, 'qr');
  const item = await findItem(userId, itemId);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  await prisma.qrCode.updateMany({ where: { itemId }, data: { revokedAt: new Date() } });
}
export async function getBarcode(userId: string, itemId: string, format: 'png' | 'svg') {
  await assertFeature(userId, 'qr');
  const item = await findItem(userId, itemId);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  let barcode = await prisma.barcode.findFirst({
    where: { itemId },
    select: { value: true, format: true },
  });
  if (!barcode)
    barcode = await prisma.barcode.create({
      data: { itemId, value: item.inventoryCode, format: 'CODE128' },
      select: { value: true, format: true },
    });
  const body = await bwipjs.toBuffer({
    bcid: 'code128',
    text: barcode.value,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
    monochrome: true,
    ...(format === 'svg' ? { format: 'svg' as const } : {}),
  });
  return {
    contentType: format === 'svg' ? 'image/svg+xml' : 'image/png',
    body: Buffer.isBuffer(body) ? body : Buffer.from(body),
  };
}
