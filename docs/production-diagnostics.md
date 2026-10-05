# Production diagnostics and dependency review

## v0.1.2 live deployment follow-up (2026-10-05)

The owner-confirmed production database now has both reviewed migrations and the required initial plans/categories. The corrected Redis/SNI code is deployed; live provider discovery, Google/Discord authorization initialization and negative state/code/replay/expiry tests pass. The deployed web/API/worker and both signal/restart checks pass. Full OAuth consent/session/logout remains blocked without authorized accounts; administrator provisioning and SMTP require credential follow-up. The current verdict is in [production verification](production-verification.md).

Initial rollout probes reproduced external handshakes exceeding the previous five-second defaults. This release retains verified TLS and explicit endpoints while bounding Redis readiness at 15 seconds, worker startup readiness at 30 seconds, and the default PostgreSQL connection timeout at 15 seconds. Operator-supplied database timeout settings take precedence. Build subprocesses load the existing environment before Vite runs. The incident findings below preserve the earlier v0.1.1 investigation snapshot; their deployed-v0.1.0 failures are historical, not the current live result.

## Incident findings

- **`spawn ps ENOENT`:** `concurrently@9.2.4 → tree-kill@1.2.2`, `tree-kill/index.js:45`, runs `ps -o pid --no-headers --ppid <pid>` on Linux. Its spawned child has no `error` listener. This is shutdown process-tree handling, not an Ovelo monitoring feature or a Node 25 defect. Production now supervises the three direct Node children and handles spawn errors/exit codes/signals without `ps`. Development still uses concurrently.
- **`SECURITY_UNAVAILABLE`:** only `apps/api/src/middleware/rate-limit.ts` produces this code. The global API limiter precedes the Google/Discord route limiters and OAuth state creation. A fresh differential probe on 2026-10-05 inside the running Node 25.9.0 container used its configured URL: the legacy ioredis connection failed with a TLS-related Redis reply, while adding only explicit hostname SNI and certificate verification passed. The shared parser also passed authentication, PING/SET/GET/DEL/EVAL and BullMQ queue/worker connectivity. Missing SNI is confirmed for this endpoint; concurrent readiness is an additional reproduced defect. The deployed application remains v0.1.0 and public probes still return this failure for both provider initialization endpoints.
- **Additional Redis issues:** the original readiness helper rejected requests during `connecting`/`reconnecting` rather than waiting; concurrent callers now share a bounded readiness promise. The worker previously passed `{url: REDIS_URL}` to BullMQ, which is not a supported endpoint option and can fall back to localhost. It now receives explicit options with decoded credentials, database, hostname/port and verified TLS.
- **Provider buttons:** login hardcoded only Google; registration had no provider controls. Both now use one component and safe runtime capability booleans. Discord `identify` signup uses the existing verified-email registration flow; linking requires an authenticated, CSRF-protected request.
- **Subdomain CSRF:** API cookies cannot be read by web-domain JavaScript. `/auth/csrf` returns only the session-bound nonce under credentialed, restrictive CORS. Session cookies remain host-only; no JWT/localStorage workaround was introduced.
- **Production PostgreSQL:** the configured external connection and TLS succeed, but Ovelo model queries return `P2021`. No `User`, `Plan`, or `_prisma_migrations` tables were found in any visible schema. The existing migrations and initial plans must be deployed to the intended database before authentication can work. Production schema/data were not modified during these probes.

Nginx, Pterodactyl allocations, bind addresses and ports are untouched by this incident fix. Updating the repository does not deploy the running container; install/build/restart the updated code through the existing deployment workflow.

## Dependency warnings reviewed

| Warning | Actual dependency path | Decision |
| --- | --- | --- |
| `cron-parser@4.9.0` | `bullmq@5.81.5` | Keep BullMQ 5. Its latest 5.x still requires this parser; BullMQ 6 uses parser 5 but is a major queue migration. Do not force a transitive override. |
| `jpeg-exif@1.1.4` | `pdfkit@0.17.2` | Keep the existing PDF renderer in this auth/startup patch. PDFKit 0.20 removes it but needs a separate document/layout compatibility pass. Ovelo uploads use Sharp, not this EXIF parser. |
| `crypto-js@4.2.0` | `pdfkit@0.17.2` | Used internally for PDF encryption, not Ovelo password/session/OAuth cryptography. PDFKit 0.20 switches crypto dependencies; do not independently replace/override security-sensitive internals. Ovelo uses Argon2id, Node crypto and JOSE. |
| ESLint 9 deprecation | direct dev tooling; `eslint-plugin-import` peers support up to ESLint 9 | Keep the compatible lint stack for this patch. Moving to ESLint 10 requires a coordinated plugin/tooling update. It is not executed by production startup. |

No dependency versions were blanket-upgraded and Prisma remains 6.x. These deprecation warnings remain visible at install time. `npm audit` is a separate vulnerability check; warnings are not suppressed.

The verification host's npm install-script policy also blocked eight package hooks. No dependency upgrade resolves that policy warning:

| Hook warning | Direct/transitive and use | Verification / deployment impact |
| --- | --- | --- |
| `@prisma/client@6.19.3` | Direct API/worker runtime | Required; explicit `prisma generate` passed. Clean builds need generated client artifacts. |
| `@prisma/engines@6.19.3` | Transitive Prisma engine tooling | Required engines were available; generation, migration and queries tested. Review hook/download permission on a clean install. |
| `prisma@6.19.3` | Direct dev/deployment CLI | Used for generation and reviewed migration deployment; not part of normal application startup. |
| `argon2@0.41.1` | Direct API password hashing | Required runtime native artifact; real hashing/login tests passed. Review install policy if a target needs compilation. |
| `esbuild@0.28.2` and `0.25.12` | Transitive tsx/Vite build tooling | Build/test execution passed with installed platform binaries. Needed at build time, not normal production startup. |
| `msgpackr-extract@3.0.4` | Optional transitive BullMQ/msgpackr native acceleration | BullMQ tests passed; pure-JavaScript fallback is supported. Primarily performance impact. |
| `unrs-resolver@1.12.2` | Transitive ESLint TypeScript resolver | Lint passed. Build/developer tooling; no application runtime impact. |

`npm audit` and `npm audit --omit=dev` reported zero vulnerabilities on this pass. Unsupported/deprecated packages still require planned maintenance. No global npm policy or blanket dependency upgrade was applied.

## Verification

```bash
npm ci --include=dev
npx prisma generate
npm run build
npm run typecheck
npm run lint
npm test
```

For integration tests, point `DATABASE_URL` and `REDIS_URL` at a **dedicated test database/cache**, deploy migrations and seed plans explicitly, then run `RUN_DB_TESTS=true npm test`. Tests create/delete their own test users; never target production. Tests cover no-ps shutdown (both signals), child startup failure, real Redis authentication/state/readiness/limits, credentialed CORS/CSRF, email verification/login/logout, signed Google signup/login/nonce/replay handling, and identify-only Discord signup/link/login. Provider responses and mail delivery are simulated at the test boundary; real consent/mail delivery still require provider credentials.
