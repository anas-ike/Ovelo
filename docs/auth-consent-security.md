# Authentication and policy acknowledgement contracts

## Sign-in, linking and logout

- Google/Discord sign-in resolves the provider ID to its existing Ovelo account. Matching email alone never silently links accounts. Google asks the user to select an account; Discord uses the configured scope.
- Linking starts only from authenticated Settings using a CSRF-protected POST. Redis holds the provider, PKCE verifier/Google nonce, initiating user and exact session. Both must still match on callback. An existing provider identity belonging to another Ovelo account is rejected.
- State is browser-cookie-bound, expiring and consumed once. Google verifies the signed issuer/audience/nonce claims and uses S256 PKCE; Discord exchanges its authorization code server-side. No provider access token is stored in browser JavaScript.
- Successful sign-in replaces only the same browser's same-kind session, revoking its old database session in the creation transaction. Other devices and the independent normal/admin cookie remain valid. Explicit linking does not create a new login session.
- Logout is CSRF-protected and revokes the current server session. Pending browser OAuth state/registration/consent tickets are invalidated and cookies cleared. The browser clears private queries and local component state only after successful server logout; failures are shown for retry.
- Authentication generations ignore stale responses. Identity changes cancel/clear queries and remount private component state. BroadcastChannel, focus/back-forward checks and private API 401 handling refresh other browser views.
- Normal OAuth returns via `/auth/complete`, which verifies an expiring completion receipt against the exact new live normal session before the browser commits that identity and opens the dashboard. Failed session checks are visible and retryable. Linking from Settings requires explicit `link-account` intent and a confirmation naming the current account; historical unintended provider associations require a separate approved repair. See [account separation incident](oauth-account-separation.md).

## Versioned policies

`policyVersions` in `packages/validation/src/index.ts` is the shared current-version registry. It must match the public Terms/Privacy and processing notice dates. Changing a version does not backfill acceptance.

`PolicyConsent` stores `(userId, policy, version, acceptedAt)` and uniquely records each version. It collects no IP address, provider token or document content. History is included in the authenticated account export.

- `POST /auth/register`: manual email registration requires a password and current `termsVersion`/`privacyVersion`; pending provider identities cannot use it. First-time provider accounts with a verified email use `/auth/oauth/consent` to create the account and exact-session receipt without a password or redundant verification mail. A provider identity lacking verified email uses strict `/auth/oauth/register` without a password and must verify the manually supplied email before authenticating.
- `POST /auth/login`: validates credentials before returning `428 POLICY_CONSENT_REQUIRED` for missing current acceptance. Required versions can be submitted with the retried login; already accepted versions need no repeated checkbox.
- Existing provider users missing current policies receive `/consent?source=oauth`; manual password users missing current policies receive `/consent?source=login`. The server determines the pending transaction kind, and the corresponding consent endpoint consumes its expiring, purpose-bound ticket once. These steps create a normal session only and cannot elevate administrator access.
- `GET /auth/policies`: returns safe versions and this session's current acceptance flags. Public responses contain no account data.
- `POST /auth/policies`: authenticated/CSRF-protected acceptance endpoint.
- `POST /items/:id/documents`: an existing current `UPLOAD_PROCESSING` acknowledgement is required, or the explicitly acknowledged current version must be supplied as `X-Upload-Processing-Version`. Middleware checks it **before multer reads the upload body**. No acknowledgement means 428; old versions fail; accepted current versions allow later uploads without repeating the prompt. CSRF, ownership, file signature/size checks, image metadata removal and structural PDF validation always apply. ClamAV is an optional additional malware layer: `CLEAN` means it actually scanned the processed file, while `NOT_CONFIGURED`, `UNAVAILABLE` and `ERROR` are recorded accurately and are accepted only when `CLAMAV_REQUIRED=false`.

All acknowledgement controls start unchecked. A client-supplied version is an explicit acceptance assertion, not an authentication or authorization credential. Server policy status and account/session authorization remain authoritative.

## Administrator operations

Normal cookies cannot authorize `/admin/*`. The host-only web gate remains tied to a live, short-lived administrator database session. Owner-only actions, primary-owner restrictions, audit and session revocation continue to apply.

Password login clears pending OAuth/manual-consent handoffs and returns an explicit administrator destination with the signed `/admin/entry` URL. The browser confirms `/admin/me` and validates that entry's same-origin/path before navigation. Administrator bootstrap and component identity are independent of normal authentication; the console home link stays at `/admin`. Successful administrator login preserves any independent normal-user session.

List endpoints return `{ data, pagination: { page, pageSize, total } }`. Page sizes are bounded to 1–100; search is server-side and stable secondary ID ordering prevents ties. Administrators see only their own audit records unless they are owners.

Recovery returns `503 ADMIN_NOT_CONFIGURED` if no undeleted administrator exists. Once configured, a matching email, mismatched email and delivery failure receive the same `{ accepted: true }` public response. This response claims request acceptance, not email delivery. Provisioning still requires the existing 16–128-character administrator password policy; `npm run resetpass` resets a provisioned administrator and never creates one.

## Verification

Use explicitly disposable PostgreSQL/Redis URLs with migrations/plans, `RUN_DB_TESTS=true`, `NODE_ENV=test`, `TRUST_PROXY=true`, empty `ADMIN_PASSWORD` and no `DOTENV_CONFIG_OVERRIDE`. Never point the integration suite at production.

Relevant regression suites: `apps/api/tests/auth-production.integration.test.ts`, `isolation.integration.test.ts`, `records-admin.integration.test.ts`, and `tests/seo.test.mjs`. They cover provider switching, exact-session linking, state/nonce/PKCE failures, replay/expiry, session rotation/logout, consent and upload enforcement, IDOR, admin recovery and bounded pagination. Provider/SMTP boundaries are simulated and are not evidence of successful live consent or email delivery.
