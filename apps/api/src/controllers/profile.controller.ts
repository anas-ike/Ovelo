import type { Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../middleware/error.js';
import { prisma } from '../database/prisma.js';
import { publicUserSelect, toPublicUser } from '../auth/auth.service.js';
import { validateUpload } from '../storage/upload-security.js';
import { uploadObject, providerFor } from '../storage/storage-manager.js';
import { redeemPremiumCode } from '../services/subscription.service.js';

export const profileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

export const profileController = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    select: {
      ...publicUserSelect,
      accounts: { select: { provider: true, createdAt: true }, orderBy: { provider: 'asc' } },
      subscription: { select: { status: true, provider: true, expiresAt: true, plan: { select: { code: true, name: true } } } },
    },
  });
  res.json({ data: { user: toPublicUser(user), accounts: user.accounts, subscription: user.subscription } });
});

export const updateProfileController = asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1).max(100) }).strict().parse(req.body);
  const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: { name: body.name }, select: publicUserSelect });
  res.json({ data: { user: toPublicUser(user) } });
});

export const uploadAvatarController = asyncHandler(async (req, res) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Select a profile picture.');
  const validated = await validateUpload(file);
  if (!validated.mimeType.startsWith('image/'))
    throw new AppError(415, 'AVATAR_TYPE_NOT_ALLOWED', 'Profile pictures must be JPG, PNG, or WEBP images.');
  const stored = await uploadObject({
    filename: `avatar-${req.auth!.userId}.webp`,
    mimeType: validated.mimeType,
    body: validated.body,
    checksum: validated.checksum,
  });
  const currentAvatar = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    select: { avatarStorageObject: { select: { id: true, provider: true, fileId: true, storageKey: true } } },
  });
  const old = currentAvatar.avatarStorageObject;
  try {
    await prisma.$transaction(async (tx) => {
      const object = await tx.storageObject.create({
        data: {
          userId: req.auth!.userId,
          provider: stored.provider,
          storageKey: stored.storageKey,
          fileId: stored.fileId,
          filename: stored.filename,
          mimeType: stored.mimeType,
          size: stored.size,
          checksum: stored.checksum,
        },
        select: { id: true },
      });
      await tx.user.update({ where: { id: req.auth!.userId }, data: { avatarStorageObjectId: object.id } });
      if (old)
        await tx.storageObject.update({ where: { id: old.id }, data: { deletedAt: new Date() } });
    });
  } catch (error) {
    await providerFor(stored.provider).delete(stored.fileId, stored.storageKey).catch(() => undefined);
    throw error;
  }
  if (old) await providerFor(old.provider).delete(old.fileId, old.storageKey).catch(() => undefined);
  res.json({ data: { hasAvatar: true } });
});

export const getAvatarController = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { avatarStorageObject: { select: { provider: true, fileId: true, storageKey: true, mimeType: true, filename: true, deletedAt: true } } },
  });
  const avatar = user?.avatarStorageObject;
  if (!avatar || avatar.deletedAt) throw new AppError(404, 'AVATAR_NOT_FOUND', 'Profile picture not found.');
  const downloaded = await providerFor(avatar.provider).download(avatar.fileId, avatar.storageKey);
  res.setHeader('Content-Type', avatar.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${avatar.filename.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(downloaded.body);
});

export const deleteAvatarController = asyncHandler(async (req, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { avatarStorageObject: { select: { id: true, provider: true, fileId: true, storageKey: true } } } });
  if (current?.avatarStorageObject) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.auth!.userId }, data: { avatarStorageObjectId: null } }),
      prisma.storageObject.update({ where: { id: current.avatarStorageObject.id }, data: { deletedAt: new Date() } }),
    ]);
    await providerFor(current.avatarStorageObject.provider).delete(current.avatarStorageObject.fileId, current.avatarStorageObject.storageKey).catch(() => undefined);
  }
  res.status(204).send();
});

export const redeemPremiumCodeController = asyncHandler(async (req, res) => {
  const body = z.object({ code: z.string().trim().min(1).max(64) }).strict().parse(req.body);
  res.json({ data: await redeemPremiumCode(req.auth!.userId, body.code) });
});
