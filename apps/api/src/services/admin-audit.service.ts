import type { Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
export function auditAdmin(req: Request, res: Response, action: string, targetType = 'Admin', targetId?: string, result = 'SUCCESS', adminId = req.auth?.userId) {
  return prisma.adminAuditLog.create({ data: { adminId, action, targetType, targetId, result, requestId: String(res.locals.requestId || '').slice(0, 100) || null, userAgent: req.get('user-agent')?.slice(0, 500) } });
}
