# OAuth setup

Provider credentials belong only on the API. `/api/v1/auth/providers` returns just Google/Discord availability booleans; both login and registration use the same buttons. Changing provider credentials needs an API restart, not frontend secrets or a rebuild.

## Google

1. Select a Google Cloud project and configure its OAuth consent screen for Ovelo.
2. Create a Web application OAuth client.
3. Authorized JavaScript origin: `https://ovelo.lightsout.in` (no path or trailing slash).
4. Redirect URI: `https://apiovelo.lightsout.in/api/v1/auth/google/callback`.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`.

Local callbacks may separately use `http://localhost:4000/api/v1/auth/google/callback` and the origin `http://localhost:5173`.

Google signup/login uses `openid email profile`, PKCE S256, signed ID-token audience/issuer/nonce validation, and a provider-verified email subject to Ovelo's domain policy. First-time users accept current Terms/Privacy at `/consent?source=oauth` and sign in without a password or redundant email-verification message. Existing provider users with current acceptance sign in directly. Existing email accounts are never implicitly linked: sign in to the existing account and confirm **Connect Google** in Settings. Linking is authenticated, CSRF-protected and bound to the exact initiating user/session.

## Discord

1. Create a Discord application and open OAuth2.
2. Add `https://apiovelo.lightsout.in/api/v1/auth/discord/callback` (local callback: `http://localhost:4000/api/v1/auth/discord/callback`).
3. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, and `DISCORD_SCOPE="identify email"`.

With `identify email`, Discord can return a verified email. Only `verified: true` email is trusted. A first-time user accepts current Terms/Privacy and signs in without a password or Ovelo verification email; subsequent sign-ins go directly to the dashboard. Changing scope takes effect on a new authorization attempt after the API restart; Discord may ask the user to authorize email access.

If deliberately configured with `identify`, or if Discord returns no verified email, an expiring HttpOnly pending-identity cookie sends the user to `/register?oauth=complete`. This provider-completion form accepts an approved email and policy confirmation through `POST /auth/oauth/register`, without a password. The supplied email must be verified through SMTP before a fresh Discord sign-in can authenticate. Existing users explicitly confirm **Connect Discord** in Settings; matching email alone never links accounts.

## Shared protections

State is random, browser-cookie-bound, expires after ten minutes, and is atomically consumed once in Redis. Atomic Lua consumption also avoids relying on the Redis 6.2-only GETDEL command. Mismatched/replayed state and disabled accounts are rejected. An existing linked account's unverified local email can be verified only when the authenticated provider supplies the same verified email; otherwise local verification is required. Policy/account-completion tickets are purpose-bound and single-use; a consumed or expired completion request requires starting provider sign-in again.

Normal success redirects to `${APP_URL}/auth/complete`, which validates an expiring receipt against the exact live session before opening the dashboard. First-time verified-email users and existing users missing policy acceptance use `${APP_URL}/consent?source=oauth`; missing-verified-email completion uses `${APP_URL}/register?oauth=complete`. Administrator success uses only the signed `/admin/entry` handoff to `/admin`, with a separate administrator session. Clients cannot choose an arbitrary callback redirect. Provider errors redirect to the appropriate login page with an allowlisted error code, never tokens or provider secrets.

Live Google/Discord consent and SMTP delivery require configured credentials and a provider test account. Automated tests simulate provider responses while exercising actual JWT signature verification, Redis state consumption, PostgreSQL accounts and sessions, email verification, linking and CSRF.
