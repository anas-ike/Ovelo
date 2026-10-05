# Ovelo Production Verification — archived v0.1.1 pass

**Ovelo v0.1.1 — Production Authentication Stabilization**
**Date:** 2026-10-05
**Executive Verdict: FAILED**

## Executive verdict

The repository fixes build and pass local security/integration verification. Production web and health are reachable, and corrected Redis TLS/SNI probes succeed. Production authentication remains unavailable: the deployed v0.1.0 endpoints return `503 SECURITY_UNAVAILABLE`, the configured external PostgreSQL database has no Ovelo tables or migration registry, and the container's configured runtime/cookie/proxy flags do not match production requirements. Google and Discord real consent/callback/session flows have not succeeded. This is a failed production verification, not an OAuth success claim.

## Root Cause: spawn ps ENOENT

`npm start` previously ran `concurrently@9.2.4`, whose `tree-kill@1.2.2` dependency calls `spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', pid])` at `node_modules/tree-kill/index.js:45`. The child has only a `close` listener and no `error` listener. It discovers descendants during shutdown; it is not required for application monitoring. Missing `ps` therefore becomes an unhandled child error.

**Fix:** production supervises direct Node API/worker/web children, with `error`, `exit`, `close`, sibling shutdown and bounded signal handling. Unexpected failures stay nonzero. `concurrently` is development-only. No procps installation is needed. No-ps tests with an empty PATH passed. Both signals passed against the actual production startup command in an isolated Node 22 container. **Resolved in this release's tested startup path; deployment of the release is still required.**

## Root Cause: SECURITY_UNAVAILABLE

Exact producer: `apps/api/src/middleware/rate-limit.ts`. Requests pass origin/CORS, session loading and authenticated-mutation CSRF before the global `/api/v1` Redis limiter; provider-specific limiters then precede OAuth initialization. A failed readiness or EVAL operation becomes the existing safe 503 structure with a request ID. This happens before Google/Discord authorization.

A fresh differential probe in the running Node 25.9.0 container used the same configured production URL: no explicit SNI failed with a TLS-related Redis reply; adding hostname SNI with certificate verification enabled passed. The original readiness implementation also rejected concurrent connecting/reconnecting requests, reproduced locally. The worker's `{url: REDIS_URL}` was not a supported BullMQ endpoint option.

**Fix:** one shared explicit Redis parser; verified TLS/SNI; decoded credentials/database; bounded shared readiness with transient recovery; startup command checks; safe diagnostic classifications; explicit BullMQ endpoint options. Protection remains fail-closed. **NOT RESOLVED on the deployed public endpoints**, which still return the 503 failure.

## Redis

- Hostname: `musai-west-mound.ovh2.cloud.layerbase.dev`
- Port: 6379; database: 0.
- TLS: PASS with certificate verification enabled.
- SNI: PASS with the Redis hostname; legacy no-SNI differential failed.
- Authentication: PASS.
- PING / SET / GET / DEL / EVAL: PASS using expiring diagnostic keys.
- Database selection: PASS on the configured DB; nonzero DB tested separately in disposable Redis.
- API: shared security-client options/commands PASS; deployed API protection still FAILS.
- Worker: corrected client connection PASS; live application job processing not claimed.
- BullMQ: queue and worker readiness, explicit remote endpoint and diagnostic queue command PASS; no localhost fallback.
- Reconnect/readiness: local real reconnect and concurrent readiness PASS; bounded-wait regression coverage included.
- Result: **PASS for live corrected-configuration probes; deployed authentication remains failed.**

Private CAs should be installed via `NODE_EXTRA_CA_CERTS`; certificate verification must remain enabled. No production credential values were saved or printed.

## PostgreSQL

- Connection: PASS using the configured external environment.
- TLS: PASS, observed via `pg_stat_ssl`; configured `sslmode=require`.
- Prisma: connection PASS; Plan/User/Warranty/MigrationJob queries FAIL with `P2021`.
- Schema: no Ovelo User/Plan tables in visible schemas; `_prisma_migrations` absent.
- Result: **FAIL — incompatible/uninitialized application schema.**

The two existing migrations and initial plans succeeded against a separate disposable PostgreSQL instance. Production schema and data were not altered. Before deployment, confirm the configured database/schema is the intended target, then apply the existing reviewed migrations with `npm run db:deploy` and provision the initial plans. No reset or destructive Prisma command was used.

## OAuth

### Google
- Login / Signup: FAIL live verification; initialization is blocked by 503.
- State: local browser binding, expiration, atomic consumption, replay rejection, nonce and PKCE tests PASS with simulated provider responses.
- Callback: local success/invalid-code/provider-timeout handling tested; no real consent callback completed.
- Session: local database-backed creation/persistence/logout tested; live session not verified.
- Result: **FAIL** for production end-to-end.

### Discord
- Login / Signup: FAIL live verification; initialization is blocked by 503.
- State: local invalid/expired/replayed state rejection tested.
- Callback: local identify-only account linking and registration completion tested with simulated provider responses.
- Session: local persistence/logout tested; live session not verified.
- Result: **FAIL** for production end-to-end.

Discord `identify` is sufficient: Ovelo obtains and verifies the required email through its existing registration flow for a new identity. Existing authenticated users can explicitly link the identity under CSRF protection. `email` permission is not necessary for this model. Provider capabilities expose booleans only, never secrets.

## CSRF / Request Protection

Actual Chromium requests from `https://ovelo.lightsout.in`, with `credentials: include`, received 503 and no token. CORS permits the configured frontend origin. Local tests cover credentialed nonce retrieval, host-only session cookies, SameSite=Lax, missing/invalid CSRF rejection and authenticated logout. The token is generated with the server session; unauthenticated `/auth/csrf` returns 401 when protection is healthy. Production requires Secure cookies and HTTPS; the configured container environment does not currently set `COOKIE_SECURE=true`, so live secure-session behavior is not verified. Security remains fail-closed on the observed Redis failure; no bypass was introduced.

## Authentication Security

Local dedicated PostgreSQL/Redis tests exercise verified email login, invalid password, login rate limiting, missing/invalid CSRF, expired/revoked sessions, authenticated/unauthenticated API access, OAuth invalid/expired/replayed state, invalid code, provider errors, session persistence/logout and cross-user isolation. Google/Discord responses and SMTP are simulated only at test boundaries; these results do not count as live OAuth or delivery verification.

## Startup

- Web: actual `npm start` PASS in isolated production-mode Node 22 and Node 25 containers; remains alive and serves built HTML.
- API: PASS after Redis/database startup checks; health returns only safe status/release metadata.
- Worker: PASS, stays alive with queue connections and exposes no HTTP port.
- Ports: verified `0.0.0.0:6968`, `0.0.0.0:6971` inside the isolated container.
- SIGTERM / SIGINT: PASS, exit 0, no shutdown timeout or `spawn ps` failure.
- Redis-unavailable startup: PASS fail-closed verification, no API listener, nonzero exit, no forced shutdown or `spawn ps` failure.
- Production startup: new release not deployed; live container is v0.1.0 / Node 25.9.0.

Node 22 LTS is recommended and tested (host 22.23.3, isolated runtime 22.23.0). Node 25.9.0 also passed isolated full-release startup and both signals and ran the live connection probes. The current production runtime was retained because this pass did not require changing it. No runtime or Pterodactyl setting was forced. The root requirement is >=20.19 to match installed tooling; startup uses dotenv rather than a Node-22-only env-file flag.

## Health Checks

- Web: PASS — `https://ovelo.lightsout.in` returned 200.
- API: PASS liveness — `https://apiovelo.lightsout.in/health` returned 200 with only safe service/status fields.
- Health is not evidence of functioning authentication or database schema.

## Browser / Build

Live Chromium desktop (1440×1000) and mobile (390×844) checks found no horizontal overflow. Deployed login has Google only; signup has neither provider. The updated artifact was also rendered in Chromium at both sizes against the real isolated web/API servers using browser transport routing: both controls were visible and disabled when that test API had no provider secrets, no horizontal overflow occurred, and version metadata was 0.1.1. No provider authorization result was synthesized for browser testing. The built release uses the exact HTTPS production API base; there is no repeated API prefix. Observed API requests use the correct domain and prefix. Framework-internal URL-parsing fallback literals are not API requests.

## Dependency Review

- `npm install`: PASS. Eight package install hooks were blocked by the host npm policy: Prisma client/engines/CLI, argon2, two esbuild versions, msgpackr-extract, unrs-resolver. Generated Prisma client, build, native password hashing and tests succeeded with installed artifacts. Clean deployments must review/allow required hooks under their npm policy; warnings were not suppressed.
- `cron-parser@4.9.0`: transitive BullMQ 5 dependency, used for schedules, deprecated; BullMQ 6 uses parser 5 but requires a separate major queue migration.
- `jpeg-exif@1.1.4`: transitive PDFKit dependency, unsupported; PDFKit 0.20 removes it, requiring document compatibility checks. Upload image parsing uses Sharp.
- `crypto-js@4.2.0`: transitive PDFKit encryption dependency, discontinued; upgrade with PDFKit rather than replacing cryptographic internals via override. Not used for Ovelo passwords or sessions.
- ESLint 9: direct dev tooling, unsupported; ESLint 10 needs coordinated plugin changes (`eslint-plugin-import` peers stop at 9). No runtime impact.
- `concurrently → tree-kill`: used only in development after this fix; production no longer needs ps. Development process-tree shutdown still requires OS utilities.
- `npm audit` and `npm audit --omit=dev`: PASS, zero reported vulnerabilities. Deprecations still require maintenance follow-up; they are not a guarantee of safety.
- Prisma retained at installed 6.19.3. No blanket upgrades, force audit fixes, or networking changes.

## Tests

| Check | Result |
| --- | --- |
| Build | PASS with production HTTPS API base |
| Typecheck | PASS |
| Lint | PASS |
| Unit/Integration tests | PASS — 5 startup/release tests plus 29 API tests, 0 skipped, dedicated PostgreSQL/Redis |
| Production-mode startup (isolated) | PASS |
| Production startup (new release deployment) | BLOCKED / not deployed |
| Production health | PASS liveness |
| Google OAuth | FAIL live verification |
| Discord OAuth | FAIL live verification |

## Files Changed

```text
.env.example
.nvmrc
CHANGELOG.js
CHANGELOG.md
README.md
apps/api/package.json
apps/api/src/app.ts
apps/api/src/auth/auth.service.ts
apps/api/src/auth/oauth-pending.service.ts
apps/api/src/auth/oauth.service.ts
apps/api/src/auth/session.service.ts
apps/api/src/config/env.ts
apps/api/src/config/redis.ts
apps/api/src/controllers/auth.controller.ts
apps/api/src/controllers/csrf.controller.ts
apps/api/src/controllers/oauth.controller.ts
apps/api/src/database/prisma.ts
apps/api/src/middleware/error.ts
apps/api/src/middleware/rate-limit.ts
apps/api/src/routes/auth.routes.ts
apps/api/src/server.ts
apps/api/src/services/migration.service.ts
apps/api/tests/auth-production.integration.test.ts
apps/api/tests/redis.test.ts
apps/api/tests/request-protection.integration.test.ts
apps/web/package.json
apps/web/server.mjs
apps/web/src/features/auth/OAuthButtons.tsx
apps/web/src/lib/api.ts
apps/web/src/pages/auth/Login.tsx
apps/web/src/pages/auth/Register.tsx
apps/web/src/styles/index.css
apps/web/vite.config.ts
apps/worker/package.json
apps/worker/src/database.ts
apps/worker/src/index.ts
docs/oauth.md
docs/production-diagnostics.md
docs/production-verification.md
docs/releases.md
package-lock.json
package.json
packages/shared/package.json
packages/shared/src/redis.ts
packages/shared/src/release.ts
packages/shared/tsconfig.json
packages/validation/package.json
scripts/start.mjs
scripts/verify-connections.mjs
tests/release.test.mjs
tests/startup.test.mjs
```

## Environment Changes Required

The container environment loaded through the existing `.env` mechanism was checked without printing secret values. Correct these observed mismatches before restarting the release:

```dotenv
NODE_ENV=production
COOKIE_SECURE=true
TRUST_PROXY=true
```

No credential change is required for the Redis SNI fix. Confirm the configured PostgreSQL target because it has no Ovelo schema; change `DATABASE_URL` only if it points at the wrong intended database/schema. `PORT`, application/API/Vite URLs, both callback URLs, `DISCORD_SCOPE=identify`, SameSite and storage settings match. `WEB_PORT` is absent and the existing 6968 default is used, so no port change is required. Provider credential variables are present; their validity requires the outstanding real OAuth tests.

Deployment follow-up: deploy this release using the existing workflow, apply reviewed migrations/initial plans to the confirmed database target, restart, then complete real Google/Discord consent and session tests. These are deployment actions, not new environment variables. No Nginx, domains, allocations, public ports or bind addresses were changed.

## Git

- Commit hash: `7f60ff05e06fdbb0f27b65567ff48dc0f154c4ea` — `chore: production verification and auth stabilization`.
- Push status: **PUSHED to `origin/main`**. `git ls-remote --heads origin main` confirmed the release hash after `git push origin main`. The initial plain `git push` needed an explicit destination because this checkout has no upstream branch.
- This post-push documentation finalization records the actual release hash and publication result. It does not change the application/version or the FAILED verdict. The release commit remains reproducibly identifiable with `git log -1 --format=%H -- CHANGELOG.js`; the report-finalization commit is identifiable with `git log -1 --format=%H -- docs/production-verification.md`.
- Working tree and both available historical commits were scanned for credential-bearing URLs/private-key/token signatures and suspicious environment assignments; no candidate production secrets were found. `.env` is not tracked. This is a heuristic scan, not proof against every possible secret format.

## Final Verdict

**FAILED.** Redis SNI and production process handling are fixed and verified in the release path, but live authentication still returns `SECURITY_UNAVAILABLE`, PostgreSQL is missing the application schema, and neither provider has a completed real end-to-end login/signup session. Google OAuth: FAIL. Discord OAuth: FAIL. Redis corrected connection probe: PASS. SECURITY_UNAVAILABLE: NOT RESOLVED in production. spawn ps ENOENT: RESOLVED in tested release startup. Build/typecheck/lint/tests: PASS.
