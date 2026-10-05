# Ovelo Production Verification

Ovelo v0.2.0 — Ownership Records and Administrator Security

Date: 2026-10-05

## Executive result

**PARTIAL — v0.2.0 is deployed and isolated authenticated workflows pass. Full live authenticated feature verification remains incomplete; production administrator provisioning and SMTP authentication need correction.**

The existing architecture, domains, proxy configuration and allocations were preserved. No successful Google/Discord consent, production user session or authenticated production item workflow is claimed. Previous release evidence is preserved in [v0.1.2](production-verification-v0.1.2.md).

## Scope delivered

- Working item Overview, Documents, Warranty, Repairs and Activity tabs, editable ownership fields, condition/value, secure creation-time attachments and partial-upload retry.
- Ownership-scoped document listing/preview/download/delete, warranty/repair CRUD and attachments, item activity, and global Documents/Locations/Activity pages.
- Saved-location/manual-address selection, validated Google Maps links/coordinates and bounded allowlisted sharing-link expansion. Optional server-side Places search uses `GOOGLE_MAPS_API_KEY`.
- Explicit opaque QR/Code 128 generation, PNG/SVG download, regeneration/expiry/revocation checks and authorization-bound resolution. Local image/camera decoding and manual fallback.
- Separate short-lived administrator sessions and CSRF cookies; OWNER/ADMIN restrictions; primary-owner protection/profile controls; secondary administration; user enable/disable; audit; session revocation; expiring, single-use recovery.
- Administrator HTML and lazy bundle server gates bound to the live database administrator session, plus SPA/API authorization. One-use entry tickets bridge the existing separate web/API hosts without widening API session-cookie scope.
- Explicit Google/Discord administrator identity linking. Normal sessions cannot stand in for administrator sessions during linking, even when both cookies are present.
- Interactive `npm run resetpass`, with hidden TTY input, enforced policy, database-authoritative password changes, revocation and audit. Restart bootstrap never overwrites a stored password.
- Public How it Works, Terms and Privacy pages and connected navigation/footer links.

## Build and dedicated-service checks

| Check | Observed result |
| --- | --- |
| Production-environment build | PASS — shared/API/worker/web; root version and HTML/API metadata `0.2.0` |
| Typecheck / lint / whitespace | PASS — `npm run typecheck`, `npm run lint`, `git diff --check` |
| Dedicated automated tests | PASS — **7 root + 43 API = 50 tests; none skipped** |
| Dependency audit | PASS — `npm audit --omit=dev`, zero reported vulnerabilities |
| Dedicated migration / seed | PASS — all three migrations, plans/categories and QR entitlement |
| Ownership isolation | PASS — foreign item, document, activity, warranty/repair IDs and attachment IDs rejected |
| Record validation | PASS — invalid dates, unsupported uploads, invalid Maps hosts/coordinates and identifier expiry/replay rejected |
| Admin authorization | PASS — separate sessions, CSRF, OWNER restrictions, main-owner protection, role/status/session revocation and audit |
| Recovery | PASS — normal/admin ticket separation, short-password rejection, atomic single-use consumption and session revocation |
| Interactive CLI | PASS — real pseudo-terminal on dedicated DB; no input echo; policy, password hash, audit and session/reset-ticket revocation verified |

Tests used explicitly isolated PostgreSQL/Redis services with `RUN_DB_TESTS=true`; they were never run against the production database. The provider and SMTP boundaries in the authentication suite are simulated, while database sessions, Redis state, JWT verification and authorization checks are real. Google/Discord administrator linking was tested with a different normal-user session present.

For a repeat dedicated run, set `DATABASE_URL` and `REDIS_URL` to disposable test services, use test security settings, clear `ADMIN_PASSWORD`, unset `DOTENV_CONFIG_OVERRIDE`, and run `RUN_DB_TESTS=true npm test`. Do not allow local production `.env` values to override those dedicated settings.

### Isolated browser evidence

A real Chromium browser exercised the built application against isolated web/API servers in the existing Node 25 container image:

- User login and item creation with an image document and searched/manual location.
- Tab navigation; document listing; warranty add/edit; repair add; persisted item activity; global locations/documents.
- Generated label previews and real QR/Code 128 image decoding and manual resolution.
- No camera request on load; generated camera-stream frames decoded through the real reader; tracks stopped after resolution; actual denied-camera fallback rendered. Physical camera hardware was not tested.
- Administrator login/one-use web gate, overview, secondary creation, primary-owner profile, user disable/enable, audit rendering, logout and subsequent gate rejection.
- Public pages on desktop/mobile; no horizontal overflow or uncaught page errors.

Browser production-named URLs were transported to isolated servers. Redirect navigation was explicitly re-entered because Playwright interception does not re-route fulfilled HTTP redirect chains; raw server redirects were independently verified. This evidence is not represented as production-domain authenticated verification.

Diagnostics reproduced intermittent geometric QR detection failures on clean generated labels. The scanner now tries exact-module decoding after normal detection; 100 randomized generated QR samples passed that fallback. QR output also uses the standard four-module quiet zone. Camera cancellation/unmount cleanup and hidden CLI prompt ordering were corrected during verification.

## Production deployment and checks

- Existing container: `8bf2b40d-ec37-47a4-a7ee-cf79077221c6`, existing user `998:998`, Node `v25.9.0`.
- Existing endpoints: `https://ovelo.lightsout.in`, `https://apiovelo.lightsout.in`; existing listeners `0.0.0.0:6968` and `0.0.0.0:6971`.
- Applied reviewed additive migration `20261005130000_functional_completion` to the owner-confirmed Aiven database. All three migrations are registered as finished.
- Seeded existing system plans/categories and QR entitlement with administrator bootstrap omitted because its configured password fails policy. No sample production account or inventory was created.
- Production had **1 user and 1 item** before this update and the same counts afterward. No configured administrator/primary owner exists.
- Existing ignored environment transferred securely to its deployment location; existing networking/startup workflow retained. Install, explicit Prisma generation and production build passed in the container. Install-script policy warnings were retained without blanket approval.
- Container restart: PASS — v0.2.0 API health 200, web/API listeners and worker started, port bindings unchanged, no new `ps`/ChildProcess shutdown failure, no configured secret found in inspected startup logs.

| Real production check | Observed result |
| --- | --- |
| Login/signup layouts and release metadata | PASS — desktop 1440×1000 and mobile 390×844; Google/Discord/email-password visible; correct HTTPS API destination |
| Public help/Terms/Privacy and admin login/recovery layouts | PASS — both viewports, no overflow or uncaught page errors |
| Administrator HTML protection | PASS — 9 direct routes redirect to `/admin/login` before protected content |
| Administrator API protection | PASS — 10 unauthenticated endpoints return 401 |
| Lazy administrator bundle / gate | PASS — bundle redirects to login; unsigned gate request rejected |
| Google authorization initialization | PASS — provider page reached; production callback, expiring Redis state, secure HttpOnly cookie, PKCE and nonce validated |
| Discord authorization initialization | PASS — provider page reached; production callback, identify scope, expiring Redis state and secure HttpOnly cookie validated |
| OAuth negative security | PASS — actual invalid provider-code exchanges, bad state, consumed/replayed state, controlled expiry of probe-owned transactions, no session issued |
| Request protection | PASS — credentialed origin, foreign-origin mutation rejection, unauthenticated API/CSRF rejection, invalid login, rate limit and Retry-After |
| Successful Google/Discord consent | **BLOCKED — authorized browser/account unavailable** |
| Authenticated production records/scanning/admin/logout | **BLOCKED — actual authenticated account unavailable** |
| Primary administrator provisioning | **FAIL — `ADMIN_PASSWORD` does not satisfy existing 16–128-character policy** |
| SMTP connection/authentication | **FAIL — configured server reached, authentication rejected with `EAUTH` on `AUTH PLAIN`** |
| SMTP recovery delivery / inbox receipt | BLOCKED — SMTP authentication failed |
| PDF success | BLOCKED — `CLAMAV_HOST` absent; scanning remains fail-closed |
| Optional Places API | NOT CONFIGURED — `GOOGLE_MAPS_API_KEY` absent; manual address search/selection and Maps links remain available |

Local verification discovered inherited shell variables taking precedence over `.env`. Real production probes were repeated with `DOTENV_CONFIG_OVERRIDE=true` so the supplied file was authoritative; dedicated tests explicitly kept that override unset. Credential values were never included in reports or tool output.

## Operator follow-up

1. Provision the primary owner using a policy-compliant `ADMIN_PASSWORD`, or run **`npm run resetpass`** interactively in the existing production container with the correct `ADMIN_EMAIL`. The command prompts without echo, writes the database, revokes sessions/tickets, and does not modify `.env`.
2. Correct `SMTP_USER` / `SMTP_PASSWORD` and the provider's SMTP authentication requirements, then repeat connection/authentication and an actual recovery-email/inbox test. Do not paste credentials into reports or chat.
3. Configure a reachable ClamAV service using `CLAMAV_HOST` / `CLAMAV_PORT` for PDF uploads. Keep fail-closed scanning.
4. Use an authorized real browser/account to complete both OAuth consent flows and exercise authenticated production item/admin/recovery/session/logout workflows. Link administrator provider identities explicitly after administrator password login.
5. `GOOGLE_MAPS_API_KEY` is optional for Places suggestions. Manual addresses and Maps links do not require it.

If the primary-owner email is changed, verify the new address before it takes effect. Verification revokes sessions; reconcile `ADMIN_EMAIL` with the verified identity before restarting. Restart bootstrap preserves the existing database password.

## Publication

- Secret checks: **PASS** — 75 intended staged files, actual configured-credential matching, secret signatures/credential-bearing external URLs, deployed frontend and inspected startup logs. Working-tree/all-local-history heuristic scan found no candidates.
- `.env` is ignored by `.gitignore:3` and untracked; it is excluded from the index. No credentials, provider payloads, tokens, screenshots or raw logs are published.
- Source publication is being finalized. The release commit identifier will be recorded after Git confirms publication.
