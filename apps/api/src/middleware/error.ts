import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const notFound: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'));
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  void next;
  const requestId = res.locals.requestId as string | undefined;
  if (error instanceof AppError)
    return res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, requestId } });
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
    { err: error, requestId, method: req.method, path: req.path },
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
