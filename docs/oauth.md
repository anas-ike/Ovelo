# OAuth setup

Provider credentials belong only on the API. `/api/v1/auth/providers` returns just Google/Discord availability booleans; both login and registration use the same buttons. Changing provider credentials needs an API restart, not frontend secrets or a rebuild.

## Google

1. Select a Google Cloud project and configure its OAuth consent screen for Ovelo.
2. Create a Web application OAuth client.
3. Authorized JavaScript origin: `https://ovelo.lightsout.in` (no path or trailing slash).
4. Redirect URI: `https://apiovelo.lightsout.in/api/v1/auth/google/callback`.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`.

Local callbacks may separately use `http://localhost:4000/api/v1/auth/google/callback` and the origin `http://localhost:5173`.

Google signup/login uses `openid email profile`, PKCE S256, signed ID-token audience/issuer/nonce validation, and a provider-verified email subject to Ovelo's domain policy. Existing email accounts are never implicitly linked: sign in to the existing account, visit `/login`, and use **Connect Google**. Linking is authenticated and CSRF-protected and bound to the initiating user.

## Discord

1. Create a Discord application and open OAuth2.
2. Add `https://apiovelo.lightsout.in/api/v1/auth/discord/callback` (local callback: `http://localhost:4000/api/v1/auth/discord/callback`).
3. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, and `DISCORD_SCOPE=identify`.

With `identify`, Discord does **not** return an email. A first-time user is sent to Ovelo's existing registration form with an expiring, HttpOnly pending-identity cookie. They supply an approved email and recovery password and verify the email through SMTP. No authenticated session is issued until verification. Subsequent Discord logins go straight to the dashboard. Existing users can sign in with email/Google, visit `/login`, and use **Connect Discord**; no additional scope is needed. The existing optional `identify email` configuration remains supported if deliberately configured.

## Shared protections

State is random, browser-cookie-bound, expires after ten minutes, and is atomically consumed once in Redis. Atomic Lua consumption also avoids relying on the Redis 6.2-only GETDEL command. Mismatched/replayed state and disabled/unverified accounts are rejected. Success redirects only to `${APP_URL}/dashboard`; the only registration-completion destination is `${APP_URL}/register?oauth=complete`. Clients cannot choose an arbitrary redirect. Provider errors redirect to the configured login page with an allowlisted error code, never tokens or provider secrets.

Live Google/Discord consent and SMTP delivery require configured credentials and a provider test account. Automated tests simulate provider responses while exercising actual JWT signature verification, Redis state consumption, PostgreSQL accounts and sessions, email verification, linking and CSRF.
