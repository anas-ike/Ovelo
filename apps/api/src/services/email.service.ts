import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
const transport = configured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    })
  : null;
async function send(to: string, subject: string, html: string) {
  if (!transport) {
    if (env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    logger.warn({ to, subject }, 'Email not sent: configure SMTP for local delivery');
    return;
  }
  await transport.sendMail({ from: `${env.SMTP_FROM_NAME} <${env.SMTP_FROM}>`, to, subject, html });
}
export const sendVerificationEmail = (to: string, token: string) =>
  send(
    to,
    'Verify your Ovelo email',
    `<p>Welcome to Ovelo.</p><p><a href="${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
  );
export const sendPasswordResetEmail = (to: string, token: string) =>
  send(
    to,
    'Reset your Ovelo password',
    `<p>We received a password reset request.</p><p><a href="${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}">Choose a new password</a></p><p>This link expires in one hour.</p>`,
  );
export const sendLoginNotification = (to: string) =>
  send(to, 'New sign-in to Ovelo', '<p>Your Ovelo account was just used to sign in.</p>');
