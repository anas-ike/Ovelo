import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../middleware/error.js';
import { hashToken } from '../utils/crypto.js';

// Host-only API cookies are intentionally not readable from the web subdomain.
// Return only the session-bound CSRF nonce over credentialed, same-origin CORS.
export const csrfTokenController = asyncHandler(async (req, res) => {
  const token: unknown = req.cookies?.ovelo_csrf;
  if (typeof token !== 'string' || hashToken(token) !== req.auth!.csrfHash) throw new AppError(403, 'CSRF_INVALID', 'Sign in again to refresh your security token.');
  res.json({ data: { csrfToken: token } });
});
