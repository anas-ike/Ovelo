import { asyncHandler } from '../utils/async-handler.js';
import { completeOAuth, oauthRedirect } from '../auth/oauth.service.js';
import { env } from '../config/env.js';
export const googleStart = asyncHandler(async (_req, res) =>
  res.redirect(await oauthRedirect('google', res)),
);
export const googleCallback = asyncHandler(async (req, res) => {
  await completeOAuth(
    'google',
    typeof req.query.state === 'string' ? req.query.state : undefined,
    req.cookies?.ovelo_oauth_state,
    typeof req.query.code === 'string' ? req.query.code : '',
    res,
    req.get('user-agent'),
  );
  res.redirect(`${env.APP_URL}/dashboard`);
});
export const discordStart = asyncHandler(async (_req, res) =>
  res.redirect(await oauthRedirect('discord', res)),
);
export const discordCallback = asyncHandler(async (req, res) => {
  await completeOAuth(
    'discord',
    typeof req.query.state === 'string' ? req.query.state : undefined,
    req.cookies?.ovelo_oauth_state,
    typeof req.query.code === 'string' ? req.query.code : '',
    res,
    req.get('user-agent'),
  );
  res.redirect(`${env.APP_URL}/dashboard`);
});
