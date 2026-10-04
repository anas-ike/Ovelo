# OAuth setup

## Google

1. Create or select a Google Cloud project.
2. Enable the Google Identity / OpenID Connect APIs as required by the console.
3. Configure the OAuth consent screen with the Ovelo product name and privacy details.
4. Add the local origin `http://localhost:5173` and the production origin `https://app.ovelo.com` as authorized origins. Add the local callback `http://localhost:4000/api/v1/auth/google/callback` and production callback `https://api.ovelo.com/api/v1/auth/google/callback` to the credential.
5. Create a Web application OAuth client.
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `.env`.

Ovelo requests `openid email profile`, validates the signed state cookie, exchanges the code server-side, and requires a provider-verified email address. Access tokens never reach React.

## Discord

1. Create a Discord application.
2. Open OAuth2 and add `http://localhost:4000/api/v1/auth/discord/callback` and `https://api.ovelo.com/api/v1/auth/discord/callback` as redirects.
3. Configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, and `DISCORD_SCOPE`.
4. The default scope is `identify`. To create an Ovelo account from Discord, the provider must return a verified email, so request the minimum additional `email` scope only if your Discord application requires it.

The callback exchanges the authorization code server-side, validates state and provider verification, applies the Ovelo domain policy, and links the provider identity to the database.
