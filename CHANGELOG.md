# Changelog

Every meaningful production pass adds a release here and in [CHANGELOG.js](CHANGELOG.js). The root package version is the application version. See [release workflow](docs/releases.md) and [production verification](docs/production-verification.md). Previous history is retained.

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
