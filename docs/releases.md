# Ovelo release workflow

The root `package.json` version is the application release version. Workspace package versions are internal package versions. Release names and verification results live in the CommonJS `CHANGELOG.js` registry; human-readable history is in `CHANGELOG.md`.

For each meaningful production change pass:

1. Increment the root version (patch for fixes, minor for compatible features, major for breaking changes).
2. Prepend matching version/name/date entries to both changelogs. Preserve every previous entry. Use `NOT_RUN` or `BLOCKED` until there is actual evidence.
3. Update `package-lock.json` with `npm install`. Never put real environment values or secrets in release files.
4. Build with the intended HTTPS `VITE_API_URL`. The build rejects local, HTTP, missing or duplicated API prefixes. Root supervisor and each service log the version/name; API health and HTML metadata expose only safe release fields.
5. Run build, typecheck, lint and tests. Integration tests require a dedicated disposable database/cache with migrations and initial plans. Provider-boundary tests do not prove real OAuth consent or mail delivery.
6. Run the actual startup/signal checks and permitted production probes. `node --import=dotenv/config scripts/verify-connections.mjs` validates configured connections after the build; it uses temporary Redis keys/a unique queue and read-only PostgreSQL queries. Do not run the integration suite against production.
7. Record actual outcomes in both changelogs and `docs/production-verification.md`, distinguishing local tests from live checks.
8. Review the diff and secret scan, then commit the code, version, changelogs and report together. Push only when requested. A failed production verdict must remain failed when checks are blocked or live failures remain.

The report identifies its corresponding release commit using `git log -1 --format=%H -- CHANGELOG.js`. A file cannot contain the literal hash of the commit that contains it (the hash changes with the file content). Chat reports the resolved hash after committing; the committed report uses this reproducible Git reference.
