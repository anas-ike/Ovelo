import { resolveMx } from 'node:dns/promises';
import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
const disposable = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'yopmail.com',
  'sharklasers.com',
]);
export async function assertEmailAllowed(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) throw new AppError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  if (env.DISPOSABLE_EMAIL_CHECK_ENABLED && disposable.has(domain))
    throw new AppError(400, 'EMAIL_NOT_ALLOWED', 'Temporary email addresses are not supported.');
  if (env.EMAIL_MX_CHECK_ENABLED) {
    try {
      if (!(await resolveMx(domain)).length) throw new Error('no mx');
    } catch {
      throw new AppError(400, 'EMAIL_NOT_ALLOWED', 'That email domain cannot receive mail.');
    }
  }
  if (domain === 'gmail.com' || domain === 'googlemail.com') return;
  const approved = await prisma.allowedEmailDomain.findFirst({
    where: { domain, enabled: true },
    select: { id: true },
  });
  if (!approved)
    throw new AppError(
      400,
      'EMAIL_DOMAIN_REQUIRES_APPROVAL',
      'This email domain requires administrator approval.',
    );
}
