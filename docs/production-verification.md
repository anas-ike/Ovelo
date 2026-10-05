# Ovelo Production Verification

**Ovelo v0.1.2 — Production Deployment and Live Authentication Verification**

**Date:** 2026-10-05

**Executive Verdict: FAILED — full authentication verification incomplete**

## Executive verdict

Ovelo v0.1.2 is deployed and operational on the existing production domains and allocations. PostgreSQL has the reviewed schema and required initial plans. Redis-backed protection and OAuth initialization now work. Real browser provider authorization and negative security tests passed.

Full authentication verification is incomplete: the owner confirmed that no authorized Google/Discord browser/account is available. The configured administrator could not be provisioned because `ADMIN_PASSWORD` fails the existing policy, and `SMTP_PASSWORD` is absent. No real authenticated user session was created or fabricated. Successful OAuth login/signup, authenticated CSRF, session persistence and logout/revocation therefore remain blocked. The overall verdict is FAILED, despite the infrastructure checks passing.

## Actual results

| Check | Result |
| --- | --- |
| Production deployment | PASS — v0.1.2 deployed to the existing server |
| PostgreSQL migration/schema | PASS — both existing migrations applied, schema up to date |
| Required initial plans | PASS — 2 plans, 8 entitlements, 7 system categories |
| Optional administrator provisioning | FAIL — `ADMIN_PASSWORD` does not satisfy existing policy |
| Redis | PASS — verified TLS/SNI/auth/commands, queues and reconnect |
| Request protection | PASS — real rate limit/origin/unauthenticated rejection; fail-closed startup |
| CSRF | PARTIAL — unauthenticated rejection/CORS passed; authenticated checks BLOCKED |
| Google authorization initialization | PASS — real Google authorization page reached |
| Google OAuth login/signup | **BLOCKED — authorized browser/account unavailable** |
| Discord authorization initialization | PASS — real Discord authorization page reached |
| Discord OAuth login/signup/linking | **BLOCKED — authorized browser/account unavailable** |
| Authenticated session/persistence | BLOCKED — actual authenticated account unavailable |
| Logout/session revocation/reuse | BLOCKED — actual authenticated account unavailable |
| SMTP/email delivery | BLOCKED — `SMTP_PASSWORD` absent |
| Web health | PASS — production HTTPS page responds 200 |
| API health | PASS — production HTTPS health responds 200 and reports v0.1.2 |
| Startup | PASS — deployed web/API/worker remain alive; ports unchanged |
| Deployed SIGTERM/SIGINT | PASS — exit 0; all three services restart |
| Git secret check | PASS — staged source, actual-value/signature/URL scans, deployed artifacts/logs |

## Root Cause: spawn ps ENOENT

The old `npm start` ran `concurrently@9.2.4 → tree-kill@1.2.2`; `tree-kill/index.js:45` invokes `ps -o pid --no-headers --ppid <pid>` without a child error listener. Production does not need this descendant discovery. The v0.1.1 direct Node supervisor fix is now deployed, with `error`/`exit`/`close` handling and bounded shutdown.

The retiring v0.1.0 process reproduced `spawn ps ENOENT` during its final shutdown. After the new supervisor started, both deployed SIGTERM and SIGINT exited 0 and restarted cleanly without this error. **RESOLVED in the deployed release.**

## Root Cause: SECURITY_UNAVAILABLE / startup timeouts

The existing safe error originates in the Redis rate limiter before OAuth state creation. The previous pass confirmed that this Redis endpoint rejects the legacy no-SNI connection and accepts explicit hostname SNI with certificate verification. That parser/queue correction is deployed.

This deployment initially encountered external Redis/PostgreSQL handshake timeouts. Timing probes reproduced connections exceeding the previous five-second defaults. Redis connection/shared readiness now has a 15-second bound, worker readiness a 30-second bound, and PostgreSQL receives a 15-second default connection timeout only when the operator has not configured one. Endpoint, decoded credentials, database selection and TLS settings are preserved. No TLS verification is disabled.

After these changes, public provider discovery returns 200, both OAuth initializers redirect to their actual providers, and CSRF returns the correct unauthenticated 401 instead of 503. **SECURITY_UNAVAILABLE is RESOLVED for the observed production initialization path.**

## PostgreSQL

- The owner explicitly confirmed database `Ovoltwst`, schema `public`, on the configured Aiven host as the intended target before writes.
- Before modification: no application tables or Prisma registry existed; connection/TLS were operational.
- Reviewed/applied existing migrations: `20261004104353_init`, `20261004133243_local_storage_provider`.
- Migration status: up to date. No reset, dropped tables, destructive push or major Prisma upgrade.
- Required plans/categories/entitlements were provisioned through the existing seed and verified by counts.
- Optional admin seed failed the existing password policy. No account was created or elevated; the owner chose to leave the credential-dependent checks blocked.
- Live TLS was observed using `pg_stat_ssl`. Prisma Plan/User/Warranty/MigrationJob queries pass from the deployed container.
- Successful authenticated session writes/persistence are BLOCKED; they are not inferred from successful database connectivity.

## Redis

- Configured hostname: `musai-west-mound.ovh2.cloud.layerbase.dev`; port 6379; database 0.
- URL recognition, decoded authentication, selected database, verified TLS and hostname SNI: PASS.
- Authentication / PING / SET / GET / DEL / EVAL: PASS using short-lived diagnostic keys.
- API request limiter and actual OAuth transaction storage/consumption: PASS.
- BullMQ queue/worker readiness and diagnostic queue operation: PASS; explicit remote host, no localhost fallback.
- Concurrent readiness callers share the same bounded promise. A real diagnostic connection reconnect passed from the deployed container.
- Database-backed sessions do not use Redis as their primary store; OAuth/security/pending state uses Redis.
- Any private CA must be supplied through `NODE_EXTRA_CA_CERTS`; verification remains enabled.

## Real browser / OAuth verification

Chromium opened `https://ovelo.lightsout.in/login` and `/register` at desktop 1440×1000 and mobile 390×844. Both pages show enabled Google and Discord controls plus email/password fields, with no horizontal overflow. HTML release metadata reports v0.1.2. Browser API requests use the exact HTTPS production API prefix; no doubled prefix or local API destination was observed. Browser tests used no request routing, service mocks, fake provider credentials or simulated authorization success.

For **each provider**, the real button was clicked, the authorization redirect reached the provider's actual page, and the emitted callback matched the configured production callback. No provider configuration error was detected at initialization. This establishes initialization only, not successful consent or credential validity for a successful authorization-code exchange.

The real emitted state was verified in production Redis: random/browser-cookie binding, bounded ten-minute TTL, secure HttpOnly SameSite=Lax cookie. Google nonce and S256 PKCE matched the server-side transaction. Discord retained `identify`; no additional permission was requested.

Actual callback tests used deliberately invalid state/code against production endpoints and real provider token exchange. Invalid state, invalid code, consumed/replayed state and expired state all failed closed and issued no session. Expiry was accelerated only for the probe's own emitted transaction; the application TTL was unchanged. Probe state keys were cleaned up.

- **Google OAuth: BLOCKED — authorized browser/account unavailable.** No successful consent/callback/identity/account/session/dashboard flow, repeat login or logout was claimed.
- **Discord OAuth: BLOCKED — authorized browser/account unavailable.** No successful consent/callback/account creation/link/session/dashboard flow or logout was claimed.

## CSRF / request protection / sessions

Real frontend `GET /api/v1/auth/csrf` with credentials returns 401 `UNAUTHENTICATED` and no token when no authenticated session exists. CORS returns the configured production origin with credentials; a foreign origin is not granted access, and a foreign-origin login mutation is rejected with 403. Safe capabilities expose provider booleans only. An unauthenticated inventory request returns 401.

Eleven real invalid email-login requests from this runner exercised the Redis limiter: invalid attempts returned 401 and the limit returned 429 with Retry-After. No test user was created. These IP/account limiter entries retain their normal application expiration.

The deployed children were inspected without printing environment values; all required runtime/cookie/proxy flags match production requirements. Secure OAuth cookies were observed. Secure authenticated session cookies, valid/missing/invalid authenticated CSRF, session persistence, expiry/revocation and post-logout cookie reuse are **BLOCKED** without an actual account. Code protections remain enabled, but this pass does not claim those unexecuted live tests passed.

## Startup / deployment / outage

- The existing container and allocation routing were used. No Nginx/DNS/domain/proxy/Pterodactyl networking change.
- Actual web/API listeners: `0.0.0.0:6968`, `0.0.0.0:6971`; worker has no public HTTP listener.
- Web/API/worker startup and readiness passed on the retained Node 25.9.0 runtime.
- Actual deployed supervisor SIGTERM and SIGINT each exited 0; each restart brought back all three services and public API health.
- A separate read-only diagnostic container used the real deployment `.env` and URLs under a network outage. The deployed API entrypoint exited nonzero at security Redis readiness and never opened the API listener. The production container's networking was untouched. No fake Redis URL or mocked service was used.
- A startup-log check found no configured credential values. Initial transient timeouts were safely classified; the recovered deployment remained operational.
- Build commands now load the existing environment before subprocesses, avoiding the runtime-mode warning from the existing install/start workflow.
- Node 22 LTS remains recommended; no runtime change was forced.

## Health / build / dependency checks

- Web: `https://ovelo.lightsout.in` — 200, v0.1.2 browser metadata.
- API: `https://apiovelo.lightsout.in/health` — 200, safe status/service/version/name/date only. No credentials, state values, filesystem paths or stack trace in health.
- Build: PASS locally and in the production container.
- Typecheck / lint: PASS.
- `npm test`: 5 startup/release tests plus 12 API unit tests passed; 19 integration tests skipped. The destructive/create-delete integration suite was not enabled against production, and simulated provider tests are not counted as live verification.
- Installed dependency versions were retained. Install-script policy warnings remain for Prisma, Argon2, esbuild, msgpackr-extract and the lint resolver; generated/native/build artifacts worked in this deployment. Production install audit reported zero vulnerabilities.
- The local build emitted a bundle-size warning; the deployed artifact built below that threshold. This is a performance follow-up, not an authentication result.
- Existing deprecations (BullMQ's cron-parser 4, PDFKit's jpeg-exif/crypto-js, ESLint 9) remain documented in [production diagnostics](production-diagnostics.md); no blanket/major dependency upgrade was applied.

## Environment changes required

No Redis, PostgreSQL, OAuth or session credential was changed. Only the required non-secret `NODE_ENV`, `COOKIE_SECURE` and `TRUST_PROXY` flags were corrected in the ignored local environment and transferred securely to the existing deployment environment.

Remaining credential configuration: **`ADMIN_PASSWORD`**, **`SMTP_PASSWORD`**. Values must be provisioned securely; none is provided in this report. An authorized Google/Discord browser/account is also required to complete consent and real session/logout verification.

## Files changed in this pass

```text
CHANGELOG.js
CHANGELOG.md
apps/api/src/config/redis.ts
apps/api/src/database/prisma.ts
apps/api/tests/database-config.test.ts
apps/api/tests/redis.test.ts
apps/worker/src/database.ts
apps/worker/src/index.ts
docs/production-verification-v0.1.1.md
docs/production-verification.md
docs/production-diagnostics.md
package-lock.json
package.json
packages/shared/package.json
packages/shared/src/database.ts
packages/shared/src/redis.ts
scripts/build.mjs
scripts/verify-connections.mjs
```

The ignored local `.env` was corrected separately and is excluded from this source/release file list. Temporary diagnostic scripts/evidence remain outside the repository. The prior v0.1.1 report is archived without changing its historical verdict; prior changelog entries are preserved.

## Git / secret safety

At the start, `git status --short` showed no `.env`; `git check-ignore -v .env` matched `.gitignore:3`; `git ls-files .env` returned no tracked file. The local environment was retained and never printed. Deployment used a permission-restricted environment file outside Git.

- Staged review: 18 intended source/test/metadata/documentation files; `.env` excluded.
- Configured secret-value matching, credential-bearing URL and private-key/provider-token signature checks: PASS, no findings. The deployed frontend and recent startup logs were checked in memory; no secret values were printed.
- `.env`: ignored, not tracked, not staged. No environment file is included in the release.
- Release commit / push status: finalized after committing. A file cannot contain the literal hash of the commit containing that same file; the release commit is identified by `git log -1 --format=%H -- CHANGELOG.js`, and publication metadata is finalized in a documentation-only follow-up.

## Final verdict

**FAILED — full authentication verification incomplete.** Deployed version: **0.1.2**. Production deployment/PostgreSQL/Redis/request protection/startup/web health/API health/Git secret check: PASS. `SECURITY_UNAVAILABLE` and `spawn ps ENOENT`: RESOLVED in observed deployed paths. Google OAuth and Discord OAuth: **BLOCKED — authorized browser/account unavailable**. Authenticated CSRF/session/logout/revocation: BLOCKED. Remaining credential configuration: `ADMIN_PASSWORD`, `SMTP_PASSWORD`. `.env` is ignored and excluded from the release. Publication evidence is recorded in the Git section.
