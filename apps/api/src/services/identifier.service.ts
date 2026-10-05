import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import { prisma } from '../database/prisma.js';
import { randomToken } from '../utils/crypto.js';
import { AppError } from '../middleware/error.js';
import { assertItem } from './item-records.service.js';
import { env } from '../config/env.js';

export async function generateIdentifier(userId: string, itemId: string, kind: 'qr' | 'barcode', expiresAt?: string | null) {
  await assertItem(userId, itemId);
  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (expiry && (Number.isNaN(expiry.getTime()) || expiry <= new Date())) throw new AppError(400, 'CODE_EXPIRY_INVALID', 'Choose a future expiry date.');
  return prisma.$transaction(async tx => {
    const value = kind === 'qr' ? randomToken(18) : `OVELO-${randomToken(18).toUpperCase()}`;
    if (kind === 'qr') await tx.qrCode.upsert({ where: { itemId }, create: { itemId, code: value, expiresAt: expiry }, update: { code: value, revokedAt: null, expiresAt: expiry } });
    else {
      await tx.barcode.updateMany({ where: { itemId, value: { startsWith: 'OVELO-' } }, data: { revokedAt: new Date() } });
      await tx.barcode.create({ data: { itemId, value, format: 'CODE128', expiresAt: expiry } });
    }
    await tx.activity.create({ data: { userId, itemId, action: kind === 'qr' ? 'QR_GENERATED' : 'BARCODE_GENERATED', description: `Generated ${kind === 'qr' ? 'QR code' : 'barcode'}` } });
    return { value, expiresAt: expiry };
  });
}
export async function getQr(userId: string, itemId: string, format: 'png' | 'svg') {
  await assertItem(userId, itemId);
  const qr = await prisma.qrCode.findFirst({ where: { itemId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { code: true } });
  if (!qr) throw new AppError(404, 'CODE_NOT_FOUND', 'Generate a QR code first.');
  const value = `${env.APP_URL}/i/${qr.code}`;
  const options = { margin: 4, width: 720, errorCorrectionLevel: 'M' as const, color: { dark: '#151719', light: '#ffffff' } };
  return format === 'svg' ? { contentType: 'image/svg+xml', body: Buffer.from(await QRCode.toString(value, { ...options, type: 'svg' })) } : { contentType: 'image/png', body: await QRCode.toBuffer(value, { ...options, type: 'png' }) };
}
export async function revokeQr(userId: string, itemId: string) {
  await assertItem(userId, itemId);
  await prisma.$transaction([
    prisma.qrCode.updateMany({ where: { itemId }, data: { revokedAt: new Date() } }),
    prisma.activity.create({ data: { userId, itemId, action: 'QR_REVOKED', description: 'Revoked QR code' } }),
  ]);
}
export async function getBarcode(userId: string, itemId: string, format: 'png' | 'svg') {
  await assertItem(userId, itemId);
  const barcode = await prisma.barcode.findFirst({ where: { itemId, value: { startsWith: 'OVELO-' }, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' }, select: { value: true } });
  if (!barcode) throw new AppError(404, 'CODE_NOT_FOUND', 'Generate a barcode first.');
  const options = { bcid: 'code128', text: barcode.value, scale: 3, height: 16, includetext: true, textxalign: 'center' as const, padding: 8 };
  return format === 'svg' ? { contentType: 'image/svg+xml', body: Buffer.from(bwipjs.toSVG(options)) } : { contentType: 'image/png', body: await bwipjs.toBuffer(options) };
}
export async function resolveIdentifier(userId: string, input: string) {
  let value = input.trim();
  if (value.length > 2048) throw new AppError(404, 'CODE_NOT_FOUND', 'Invalid or expired Ovelo code, or this item is not available to your account.');
  if (value.startsWith('https://')) {
    try { const url = new URL(value); if (url.origin !== new URL(env.APP_URL).origin || !/^\/i\/[a-f0-9]{36}$/.test(url.pathname) || url.search || url.hash) throw new Error(); value = url.pathname.slice(3); }
    catch { value = ''; }
  }
  const active = { userId, deletedAt: null };
  let itemId: string | undefined;
  if (/^[a-f0-9]{36}$/.test(value)) itemId = (await prisma.qrCode.findFirst({ where: { code: value, revokedAt: null, item: active, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { itemId: true } }))?.itemId;
  else if (/^[\w-]{1,100}$/.test(value)) itemId = (await prisma.barcode.findFirst({ where: { value, revokedAt: null, item: active, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { itemId: true } }))?.itemId;
  if (!itemId) throw new AppError(404, 'CODE_NOT_FOUND', 'Invalid or expired Ovelo code, or this item is not available to your account.');
  return { itemId };
}
