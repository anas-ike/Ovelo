# Changelog

Every meaningful production pass adds a release here and in [CHANGELOG.js](CHANGELOG.js). The root package version is the application version. See [release workflow](docs/releases.md) and [production verification](docs/production-verification.md). Previous history is retained.

## v0.2.0 — Ownership Records and Administrator Security
Date: 2026-10-05

### Added / Fixed
- Functional item tabs; documents, warranty and repair records, attachments, item activity and location selection.
- User-scoped global document/location pages and safe Google Maps link parsing.
- Opaque QR/barcode generation, PNG/SVG download, local camera/image scanning and manual fallback.
- Server-gated admin pages, separate secure sessions, owner/admin roles, administrator management, audit and recovery.
- Secure `npm run resetpass` and explicit primary-admin bootstrap.
- Public help, Terms and Privacy destinations.

### Verification
- Build, typecheck and lint: PASS. Dedicated PostgreSQL/Redis tests: **50 passed (7 root + 43 API), none skipped**. Provider exchanges and SMTP are simulated in the authentication integration suite.
- Isolated browser workflows: PASS — item creation with document/location, tabs, warranty/repair editing, activity, generated PNG/SVG labels, real QR/Code 128 image decoding and manual resolution, administrator gate/login, secondary creation, owner profile, user enable/disable, audit and logout revocation.
- Camera opt-in, generated-frame decoding, stream cleanup and denied-camera fallback: PASS. Physical-device camera capture: NOT TESTED.
- Secure interactive CLI recovery: PASS on a dedicated database — hidden TTY input, short-password rejection, hash update, session/reset-ticket revocation and audit. Fixed a prompt ordering race that could echo immediately pasted input.
- Deployed v0.2.0 through the existing Pterodactyl workflow; additive migration `20261005130000_functional_completion` applied. Existing production records preserved. Web/API/worker startup and unchanged allocations: PASS.
- Real production public/auth/recovery pages on desktop/mobile, nine administrator HTML redirects, ten unauthenticated administrator API rejections, protected lazy admin bundle and unsigned-gate rejection: PASS.
- Real Google/Discord authorization initialization, state/nonce/PKCE protections, invalid codes, replay/expiry, CORS/origin rejection and login rate limiting: PASS.
- Google/Discord successful consent and authenticated production feature workflows: **BLOCKED — authorized browser/account unavailable**.
- Primary administrator provisioning: FAIL — configured `ADMIN_PASSWORD` does not satisfy the existing 16–128-character policy. SMTP authentication: FAIL — server rejected configured credentials with `EAUTH`; delivery remains blocked.
- PDF uploads remain fail-closed because `CLAMAV_HOST` is absent. Optional Places search is unconfigured; manual address selection and Google Maps links work.
- **Verdict: PARTIAL — deployed and verified with dedicated accounts; full live authenticated functionality remains incomplete.** See the versioned evidence and operator follow-up in [production verification](docs/production-verification.md).
- Secret checks: PASS — intended staged files, configured-credential matching, signatures/history, deployed frontend and inspected startup logs; `.env` ignored and excluded.

## v0.1.2 — Production Deployment and Live Authentication Verification
Date: 2026-10-05

### Deployment
- Production verification uses the supplied ignored local `.env` and existing domains/allocations.
- Deployed v0.1.2 to the existing Pterodactyl server; web/API/worker and production-domain health are operational.
- Applied both existing reviewed migrations to the owner-confirmed Aiven database; required plans, entitlements and categories are present.

### Fixed
- Reproduced slow external handshakes exceeding five-second defaults; Redis connection/readiness is bounded at 15 seconds and worker readiness at 30 seconds.
- PostgreSQL defaults to a bounded 15-second connection timeout while preserving explicit operator settings, endpoint, credentials and TLS.
- Production build subprocesses load the same ignored environment as startup.

### Verification
- Build/typecheck/lint: PASS. Tests: 17 passed, 19 integration tests skipped; integration tests were not run against production and do not count as real OAuth verification.
- Production PostgreSQL schema/TLS/queries, Redis TLS/SNI/auth/commands/BullMQ/reconnect, real provider initialization and Redis state protections: PASS.
- Both production Login/Signup pages show Google, Discord and email/password on desktop/mobile; HTTPS API destinations and release metadata: PASS.
- Live invalid-state/code, replay, controlled own-transaction expiry, origin rejection, unauthenticated API rejection and login rate limit: PASS.
- Deployed SIGTERM/SIGINT and restart: PASS. Isolated real-configuration network outage: API startup fails closed.
- CSRF: unauthenticated rejection/CORS verified; authenticated nonce/mutation checks BLOCKED without an actual account.
- Google OAuth: **BLOCKED — authorized browser/account unavailable**.
- Discord OAuth: **BLOCKED — authorized browser/account unavailable**.
- Authenticated session/logout/revocation: BLOCKED; administrator seed fails the existing `ADMIN_PASSWORD` policy. SMTP delivery: BLOCKED by absent `SMTP_PASSWORD`.
- **Executive verdict: FAILED — full authentication verification incomplete.** Infrastructure and negative security passes do not establish successful user authentication.
- Git secret check: PASS — staged files, actual configured credential matching, secret signatures, deployed frontend and startup logs. `.env` is ignored and excluded. Publication evidence is recorded in the matching report.

## v0.1.1 — Production Authentication Stabilization
Date: 2026-10-05

### Fixed
- Replaced production `concurrently → tree-kill → ps` shutdown with direct Node supervision and handled child errors, exits, closes and signals.
- Centralized Redis URL parsing with decoded authentication, database selection, explicit hostname/SNI and verified TLS; corrected BullMQ endpoint configuration.
- Shared a bounded readiness operation across concurrent callers and reconnects; added fail-closed startup/security diagnostics.
- Connected Google and Discord controls on login/signup to public availability booleans and credentialed session-bound CSRF retrieval.
- Retained Discord `identify` through the existing verified-email registration/account-linking architecture.
- Preserved logout database failures, added database startup checks and sanitized callback failures.
- Validated the production API build URL and published package-version/release metadata in HTML, API health and service logs.

### Security
- Preserved CSRF, origin checks, cookie security, rate limiting, atomic expiring OAuth state, Google PKCE/nonce/signature validation and TLS certificate verification.
- Live SNI differential: legacy connection failed; explicit SNI passed using the configured production URL, with no credentials logged.
- Live PostgreSQL connection/TLS passed, but application schema checks failed (`P2021`, migration registry absent).
- The container's configured `NODE_ENV`, `COOKIE_SECURE` and `TRUST_PROXY` do not match required production values; correction is required before deployment.

### Verification
- Install, build, typecheck and lint: PASS (install-script policy warnings documented).
- Unit/integration tests: PASS — 5 startup/release tests and 29 API tests, none skipped in the dedicated-service run. Provider responses and SMTP were simulated at test boundaries.
- Isolated actual `npm start`, web/API listeners 6968/6971, worker, SIGTERM and SIGINT: PASS on Node 22 and Node 25. Redis-unavailable startup failed closed, exited nonzero and did not start the API listener.
- Production Redis commands and BullMQ connection probes: PASS.
- Production web and public API health: PASS.
- Production authentication/CSRF initialization: FAIL — deployed endpoints still return `SECURITY_UNAVAILABLE`.
- Production PostgreSQL application queries: FAIL — missing Ovelo tables.
- Google OAuth and Discord OAuth end-to-end: FAIL verification — no successful live consent/callback/account/session flow.
- **Executive verdict: FAILED.** This release is not represented as deployed or production-authentication verified.

## v0.1.0 — Initial Ovelo Application and Pterodactyl Deployment
Date: not recorded in the historical release registry.

- Existing application baseline: ownership platform and Pterodactyl deployment through commit `1dc18a5`.
- Historical verification results: NOT RECORDED; no results reconstructed or invented.
