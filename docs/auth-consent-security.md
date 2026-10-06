# Authentication and policy acknowledgement contracts

## Sign-in, linking and logout

- Google/Discord sign-in resolves the provider ID to its existing Ovelo account. Matching email alone never silently links accounts. Google asks the user to select an account; Discord uses the configured scope.
- Linking starts only from authenticated Settings using a CSRF-protected POST. Redis holds the provider, PKCE verifier/Google nonce, initiating user and exact session. Both must still match on callback. An existing provider identity belonging to another Ovelo account is rejected.
- State is browser-cookie-bound, expiring and consumed once. Google verifies the signed issuer/audience/nonce claims and uses S256 PKCE; Discord exchanges its authorization code server-side. No provider access token is stored in browser JavaScript.
- Successful sign-in replaces only the same browser's same-kind session, revoking its old database session in the creation transaction. Other devices and the independent normal/admin cookie remain valid. Explicit linking does not create a new login session.
- Logout is CSRF-protected and revokes the current server session. Pending browser OAuth state/registration/consent tickets are invalidated and cookies cleared. The browser clears private queries and local component state only after successful server logout; failures are shown for retry.
- Authentication generations ignore stale responses. Identity changes cancel/clear queries and remount private component state. BroadcastChannel, focus/back-forward checks and private API 401 handling refresh other browser views.

## Versioned policies

`policyVersions` in `packages/validation/src/index.ts` is the shared current-version registry. It must match the public Terms/Privacy and processing notice dates. Changing a version does not backfill acceptance.

`PolicyConsent` stores `(userId, policy, version, acceptedAt)` and uniquely records each version. It collects no IP address, provider token or document content. History is included in the authenticated account export.

- `POST /auth/register`: requires `termsVersion` and `privacyVersion` to equal current versions before creating an account. Provider registration uses the pending identity cookie and a verified/recovery email flow.
- `POST /auth/login`: validates credentials before returning `428 POLICY_CONSENT_REQUIRED` for missing current acceptance. Required versions can be submitted with the retried login; already accepted versions need no repeated checkbox.
- Existing provider users missing current policies receive `register?oauth=consent`; `POST /auth/oauth/consent` consumes an expiring provider-bound identity ticket once. This step creates a normal session only, and cannot elevate administrator access.
- `GET /auth/policies`: returns safe versions and this session's current acceptance flags. Public responses contain no account data.
- `POST /auth/policies`: authenticated/CSRF-protected acceptance endpoint.
- `POST /items/:id/documents`: an existing current `UPLOAD_PROCESSING` acknowledgement is required, or the explicitly acknowledged current version must be supplied as `X-Upload-Processing-Version`. Middleware checks it **before multer reads the upload body**. No acknowledgement means 428; old versions fail; accepted current versions allow later uploads without repeating the prompt. CSRF, ownership, file signature/size checks, image metadata removal and fail-closed PDF scanning still apply.

All acknowledgement controls start unchecked. A client-supplied version is an explicit acceptance assertion, not an authentication or authorization credential. Server policy status and account/session authorization remain authoritative.

## Administrator operations

Normal cookies cannot authorize `/admin/*`. The host-only web gate remains tied to a live, short-lived administrator database session. Owner-only actions, primary-owner restrictions, audit and session revocation continue to apply.

List endpoints return `{ data, pagination: { page, pageSize, total } }`. Page sizes are bounded to 1–100; search is server-side and stable secondary ID ordering prevents ties. Administrators see only their own audit records unless they are owners.

Recovery returns `503 ADMIN_NOT_CONFIGURED` if no undeleted administrator exists. Once configured, a matching email, mismatched email and delivery failure receive the same `{ accepted: true }` public response. This response claims request acceptance, not email delivery. Provisioning still requires the existing 16–128-character administrator password policy; `npm run resetpass` resets a provisioned administrator and never creates one.

## Verification

Use explicitly disposable PostgreSQL/Redis URLs with migrations/plans, `RUN_DB_TESTS=true`, `NODE_ENV=test`, `TRUST_PROXY=true`, empty `ADMIN_PASSWORD` and no `DOTENV_CONFIG_OVERRIDE`. Never point the integration suite at production.

Relevant regression suites: `apps/api/tests/auth-production.integration.test.ts`, `isolation.integration.test.ts`, `records-admin.integration.test.ts`, and `tests/seo.test.mjs`. They cover provider switching, exact-session linking, state/nonce/PKCE failures, replay/expiry, session rotation/logout, consent and upload enforcement, IDOR, admin recovery and bounded pagination. Provider/SMTP boundaries are simulated and are not evidence of successful live consent or email delivery.
