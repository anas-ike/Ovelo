import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { redisFailure } from '@ovelo/shared/redis';
import { auditAdmin } from '../services/admin-audit.service.js';
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const notFound: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'));
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  void next;
  const requestId = res.locals.requestId as string | undefined;
  if (req.adminAuth && req.path.startsWith('/api/v1/admin/')) {
    const denied =
      error instanceof ZodError ||
      (error instanceof AppError && error.status < 500) ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002');
    void auditAdmin(
      req,
      res,
      `ADMIN_ACTION_${req.method}_DENIED`,
      'API',
      String(req.route?.path || 'unknown').slice(0, 100),
      denied ? 'DENIED' : 'FAILED',
      req.adminAuth.userId,
    ).catch(() => logger.error({ subsystem: 'admin-audit', requestId }, 'Audit write failed'));
  }
  if (error instanceof AppError)
    return res
      .status(error.status)
      .json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          requestId,
        },
      });
  if (error instanceof ZodError)
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted fields.',
        details: error.flatten().fieldErrors,
        requestId,
      },
    });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return res
      .status(409)
      .json({ error: { code: 'CONFLICT', message: 'That value is already in use.', requestId } });
  logger.error(
    {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      code: redisFailure(error) === 'REDIS_UNAVAILABLE' ? 'UNEXPECTED_ERROR' : redisFailure(error),
      requestId,
      method: req.method,
      route: req.route?.path,
    },
    'Unhandled request error',
  );
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Try again shortly.',
      requestId,
    },
  });
};
