import 'dotenv/config';
import { z } from 'zod';

const boolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');
const number = z.coerce.number().int().positive();
const raw = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: number.default(4000),
  WEB_PORT: number.default(6968),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  SESSION_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  TRUST_PROXY: boolean.default(false),
  STORAGE_PROVIDER: z.enum(['local', 'google-drive', 'bunny']).default('local'),
  LOCAL_STORAGE_PATH: z.string().min(1).default('/home/container/storage'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_CALLBACK_URL: z.string().url().optional(),
  DISCORD_SCOPE: z.enum(['identify', 'identify email']).default('identify'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: number.default(587),
  SMTP_SECURE: boolean.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@example.com'),
  SMTP_FROM_NAME: z.string().default('Ovelo'),
  ADMIN_EMAIL: z.string().email().default('contact@lightsout.in'),
  ADMIN_PASSWORD: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional(),
  BUNNY_ENABLED: boolean.default(false),
  BUNNY_STORAGE_ZONE: z.string().optional(),
  BUNNY_STORAGE_API_KEY: z.string().optional(),
  BUNNY_CDN_URL: z.string().url().optional(),
  FREE_MAX_ITEMS: number.default(100),
  FREE_MAX_STORAGE_BYTES: z.coerce.bigint().default(524288000n),
  PREMIUM_MAX_ITEMS: z.coerce.number().int().nonnegative().default(0),
  PREMIUM_MAX_STORAGE_BYTES: z.coerce.bigint().default(21474836480n),
  MAX_UPLOAD_SIZE: number.default(26214400),
  MAX_IMAGE_SIZE: number.default(10485760),
  MAX_DOCUMENT_SIZE: number.default(26214400),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/)
    .default('ovelo_session'),
  COOKIE_SECURE: boolean.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CSRF_ENABLED: boolean.default(true),
  RATE_LIMIT_WINDOW: number.default(900000),
  RATE_LIMIT_MAX: number.default(100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  EMAIL_VERIFICATION_REQUIRED: boolean.default(true),
  WARRANTY_NOTIFICATION_ENABLED: boolean.default(true),
  DISPOSABLE_EMAIL_CHECK_ENABLED: boolean.default(true),
  EMAIL_MX_CHECK_ENABLED: boolean.default(false),
});
const parsed = raw.safeParse(
  Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== '')),
);
if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}
export const env = parsed.data;
if (
  env.NODE_ENV === 'production' &&
  (!env.COOKIE_SECURE ||
    !env.CSRF_ENABLED ||
    !env.EMAIL_VERIFICATION_REQUIRED ||
    !env.APP_URL.startsWith('https://') ||
    !env.API_URL.startsWith('https://') ||
    !process.env.REDIS_URL ||
    [env.GOOGLE_CALLBACK_URL, env.DISCORD_CALLBACK_URL].some((url) => url && !url.startsWith('https://')) ||
    env.SESSION_SECRET.includes('replace-with'))
)
  throw new Error(
    'Production requires HTTPS application/API/callback URLs, explicit Redis configuration, secure cookies, CSRF, email verification, and a random session secret',
  );
