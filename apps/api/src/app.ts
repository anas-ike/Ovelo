import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import { loadSession, csrf } from './middleware/auth.js';
import { AppError, errorHandler, notFound } from './middleware/error.js';
import { rateLimit } from './middleware/rate-limit.js';
import { authRouter } from './routes/auth.routes.js';
import { itemRouter } from './routes/item.routes.js';
import { locationRouter } from './routes/location.routes.js';
import { activityRouter } from './routes/activity.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { documentRouter } from './routes/document.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { qrRouter } from './routes/qr.routes.js';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
app.use(requestId);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.NODE_ENV === 'production' ? undefined : false,
  }),
);
app.use(
  cors({
    origin: env.APP_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.get('origin') &&
    req.get('origin') !== new URL(env.APP_URL).origin
  )
    return next(new AppError(403, 'ORIGIN_INVALID', 'Request origin is not allowed.'));
  if (
    req.get('sec-fetch-site') === 'cross-site' &&
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
  )
    return next(new AppError(403, 'ORIGIN_INVALID', 'Cross-site requests are not allowed.'));
  next();
});
app.use(loadSession);
app.use(csrf);
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ovelo-api' }));
const api = express.Router();
api.use('/auth', authRouter);
api.use('/items', itemRouter);
api.use('/inventory', locationRouter);
api.use('/activity', activityRouter);
api.use('/admin', adminRouter);
api.use('/reports', reportRouter);
api.use('/', documentRouter);
api.use('/', qrRouter);
app.use('/api/v1', rateLimit('api', 300), api);
app.use(notFound);
app.use(errorHandler);
