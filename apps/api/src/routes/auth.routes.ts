import { Router } from 'express';
import { csrf, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  discordCallback,
  discordStart,
  googleCallback,
  googleStart,
  providerCapabilities,
  providerResult,
  pendingProvider,
  consentProvider,
  registerProvider,
  linkProvider,
} from '../controllers/oauth.controller.js';
import { csrfTokenController } from '../controllers/csrf.controller.js';
import {
  registerController,
  loginController,
  logoutController,
  meController,
  verifyController,
  forgotController,
  resetController,
  changePasswordController,
  changeEmailController,
  sessionsController,
  revokeSessionController,
  logoutAllController,
  exportController,
  deleteAccountController,
  policiesController,
  acceptPoliciesController,
  pendingConsentController,
  consentController,
} from '../controllers/auth.controller.js';
export const authRouter = Router();
authRouter.get('/providers', providerCapabilities);
authRouter.get('/consent/pending', pendingConsentController);
authRouter.post('/consent', rateLimit('policy-consent', 10), consentController);
authRouter.get('/policies', policiesController);
authRouter.post(
  '/policies',
  requireAuth,
  csrf,
  rateLimit('policy-consent', 20),
  acceptPoliciesController,
);
authRouter.get('/oauth/pending', pendingProvider);
authRouter.get('/oauth/result', providerResult);
authRouter.post('/oauth/consent', rateLimit('oauth-consent', 5), consentProvider);
authRouter.post('/oauth/register', rateLimit('oauth-register', 5), registerProvider);
authRouter.get('/csrf', requireAuth, csrfTokenController);
authRouter.post('/:provider/link', requireAuth, csrf, rateLimit('oauth-link', 10), linkProvider);
authRouter.post('/register', rateLimit('register', 5), registerController);
authRouter.post('/login', rateLimit('login', 10), loginController);
authRouter.post('/forgot-password', rateLimit('forgot-password', 5), forgotController);
authRouter.post('/reset-password', rateLimit('reset-password', 5), resetController);
authRouter.post('/verify-email', rateLimit('verify-email', 10), verifyController);
authRouter.post('/logout', csrf, logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.get('/sessions', requireAuth, sessionsController);
authRouter.post('/change-password', requireAuth, csrf, changePasswordController);
authRouter.post('/change-email', requireAuth, csrf, changeEmailController);
authRouter.delete('/sessions/:id', requireAuth, csrf, revokeSessionController);
authRouter.post('/logout-all', requireAuth, csrf, logoutAllController);
authRouter.get('/export', requireAuth, exportController);
authRouter.delete('/account', requireAuth, csrf, deleteAccountController);
authRouter.get('/google', rateLimit('oauth-google', 10), googleStart);
authRouter.get('/google/callback', rateLimit('oauth-google-callback', 10), googleCallback);
authRouter.get('/discord', rateLimit('oauth-discord', 10), discordStart);
authRouter.get('/discord/callback', rateLimit('oauth-discord-callback', 10), discordCallback);
