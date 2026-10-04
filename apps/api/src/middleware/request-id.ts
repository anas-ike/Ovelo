import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header('x-request-id')?.slice(0, 80) || randomUUID();
  res.setHeader('x-request-id', id);
  res.locals.requestId = id;
  next();
};
