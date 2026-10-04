import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import { assertStorageAvailable } from './plan.service.js';
import { uploadObject, providerFor } from '../storage/storage-manager.js';
import type { DocumentKind } from '@prisma/client';
import type { StorageUpload } from '../storage/storage-provider.js';
export async function uploadDocument(
  userId: string,
  itemId: string,
  input: StorageUpload & { size: number },
  kind: DocumentKind,
  title: string,
) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  await assertStorageAvailable(userId, input.size);
  const stored = await uploadObject(input);
  try {
    const document = await prisma.$transaction(async (tx) => {
      const object = await tx.storageObject.create({
        data: {
          userId,
          provider: stored.provider,
          storageKey: stored.storageKey,
          fileId: stored.fileId,
          filename: stored.filename,
          mimeType: stored.mimeType,
          size: stored.size,
          checksum: stored.checksum,
        },
      });
      const created = await tx.document.create({
        data: { itemId, storageObjectId: object.id, kind, title },
        select: {
          id: true,
          kind: true,
          title: true,
          createdAt: true,
          storageObject: { select: { filename: true, mimeType: true, size: true } },
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { storageUsedBytes: { increment: BigInt(stored.size) } },
      });
      await tx.activity.create({
        data: { userId, itemId, action: 'DOCUMENT_UPLOADED', description: `Uploaded ${title}` },
      });
      return created;
    });
    return document;
  } catch (error) {
    await providerFor(stored.provider)
      .delete(stored.fileId, stored.storageKey)
      .catch(() => undefined);
    throw error;
  }
}
export async function downloadDocument(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, item: { userId, deletedAt: null } },
    select: {
      title: true,
      storageObject: {
        select: { provider: true, fileId: true, storageKey: true, filename: true, mimeType: true },
      },
    },
  });
  if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
  return {
    ...(await providerFor(document.storageObject.provider).download(
      document.storageObject.fileId,
      document.storageObject.storageKey,
    )),
    title: document.title,
  };
}
export async function deleteDocument(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, item: { userId }, storageObject: { deletedAt: null } },
    select: {
      id: true,
      itemId: true,
      storageObject: {
        select: { id: true, provider: true, fileId: true, storageKey: true, size: true },
      },
    },
  });
  if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
  await providerFor(document.storageObject.provider).delete(
    document.storageObject.fileId,
    document.storageObject.storageKey,
  );
  await prisma.$transaction([
    prisma.document.delete({ where: { id: document.id } }),
    prisma.storageObject.update({
      where: { id: document.storageObject.id },
      data: { deletedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { storageUsedBytes: { decrement: document.storageObject.size } },
    }),
    prisma.activity.create({
      data: {
        userId,
        itemId: document.itemId,
        action: 'DOCUMENT_DELETED',
        description: 'Deleted a supporting document',
      },
    }),
  ]);
}
