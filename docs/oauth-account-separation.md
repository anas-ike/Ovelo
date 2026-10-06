# OAuth account separation incident — 2026-10-06

## Confirmed cause and production repair

Production had a Google identity and a Discord identity attached to one regular Ovelo user. The Discord link and its `OAUTH_ACCOUNT_LINKED` event dated from 2026-10-05, before the sign-in/link separation fix. Logging out revokes a session; it does not remove a persisted provider association. Different provider emails do not make explicitly linked identities separate accounts.

With the affected user's approval, the unwanted Discord link was removed and two affected normal sessions revoked in a database transaction. The Google identity, administrator sessions and ownership records were preserved. A private recovery backup was retained outside the public web root and Git. At the time of that repair, subsequent Discord authorization resolved an unlinked provider identity and required separate registration; the identify-only production scope required manually supplying and verifying an email. The passwordless follow-up below supersedes that onboarding behavior.

## Callback and browser boundary changes

- Successful normal OAuth callbacks now redirect to `/auth/complete`. A short-lived, HttpOnly, server-stored completion receipt binds the callback result to the exact new normal session and user.
- `GET /auth/oauth/result` requires that receipt **and** the matching live session. A missing cookie, another user's cookie, a different session or a revoked session returns `OAUTH_SESSION_MISMATCH`. The receipt cannot create a session or bypass authentication. It is idempotent for its 120-second TTL; logout and new sign-in invalidate it.
- The browser confirms that result, clears private queries and commits the returned identity before navigating to the dashboard. Cookie/session failures show a visible retryable error rather than silently falling back to the login page.
- Failed `/auth/me` checks caused by service/policy errors display a retryable session error; only an unauthenticated response produces the ordinary login redirect.
- A validated normal sign-in callback removes the prior normal identity before provider exchange/registration/consent. Failed or incomplete switching cannot keep an old Google session active. Administrator sessions and exact-session account linking remain independent.
- Normal account linking requires `{ intent: 'link-account' }` and an explicit Settings confirmation naming the current account. Older cached UI that attempts linking without this intent is rejected. Linking remains CSRF-protected and bound to the initiating user and session.
- OAuth rejections and session-confirmation failures log safe reason codes and request IDs, without authorization codes, cookies, provider tokens or raw provider payloads.

## Evidence and remaining live check

- Dedicated disposable API suite: 77 tests passed, none skipped; authentication suite: 24 passed.
- Built Chromium workflow: 11 groups passed, including Google → logout → Discord with separate identities, missing session-cookie error/retry, stale authentication response rejection, cross-tab logout, private-record isolation, policy/upload consent and 72 administrator responsive checks.
- Typecheck, lint, production build, dependency audit and heuristic secret scan passed. Production audit reports zero vulnerabilities.
- The production account-link defect is confirmed and repaired. The reported Google blank-login return could not be reproduced using the user's live provider account; no authorized external browser credentials were available. The old browser session-check behavior suppressed failures, and the new completion boundary makes those failures explicit. A live Google retry is still needed to establish whether any browser-specific cookie or provider failure remains.
- The fix tree was deployed and production restarted successfully: API health 200/v0.4.0, all three services started, existing ports unchanged, `/auth/complete` served with no-store/noindex, and unauthenticated completion rejected with 401/`OAUTH_SESSION_MISMATCH`. A post-repair query confirmed zero Discord links on the affected Google user and zero remaining active normal sessions. The user deferred the live Google retry because they cannot test right now.

## v0.4.1 passwordless and administrator-entry follow-up

The user later reported that new Google/Discord authorization prefilled password registration and that `/admin/login` reached `/dashboard`. The password registration was reproduced in the first-time-provider path. The production primary owner and all console features remained present; the exact live administrator redirect cause remains unconfirmed without production credentials.

Verified-email provider onboarding now creates a passwordless account after current policy confirmation. Discord requests `identify email`; identify-only/missing-email completion remains passwordless but requires verifying the manually supplied email. Subsequent provider sign-in resolves the exact provider ID and existing consent, with the same receipt/session boundary and no email merging. Administrator entry rejects `/dashboard`, confirms the separate administrator identity, isolates normal-session bootstrap/remounts, clears pending login handoffs and keeps the console home link on `/admin`.

Disposable API verification passed 79 tests; built Chromium passed 15 workflow groups including first-time/repeat Google and Discord, separate normal/admin sessions, rejected normal-dashboard destination and 72 responsive administrator checks. Patch deployment and authorized live account confirmation are recorded in [production verification](production-verification.md).
