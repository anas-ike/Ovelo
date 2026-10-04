# Ovelo

**What Do I Own?**

Ovelo is a private, production-oriented digital record of everything a person owns. Ownership records are the core model; receipts, warranties, manuals, photos, repairs, and insurance documents are supporting records attached to them.

## Stack

- **Web:** React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **API:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Worker:** BullMQ, Redis
- **Storage:** provider abstraction with Google Drive and Bunny implementations
- **Security:** Argon2id passwords, opaque database sessions, HttpOnly cookies, CSRF, Helmet, request IDs, server-side authorization and Zod validation

## Repository layout

```text
apps/web       React application
apps/api       Express REST API (/api/v1)
apps/worker    Redis-backed background workers
packages/types Shared API-facing types
packages/validation Shared Zod schemas
packages/shared Brand and queue constants
prisma         Database schema and seed
docs           Operations and provider setup
```

## Local development

Requirements: Node.js 20+, Docker, and npm 10+.

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:4000/health](http://localhost:4000/health).

The default policy allows Gmail addresses. Business and custom domains must be added by an administrator in the admin interface or seeded directly in `AllowedEmailDomain`. SMTP is required for real email delivery in production. In development, an unconfigured SMTP transport deliberately does not claim delivery; configure SMTP before testing verification and password recovery end-to-end.

## Workspace commands

```bash
npm run dev                 # web, API, and worker
npm run build               # all production builds
npm run typecheck           # every workspace
npm run lint
npm run format:check
npm test
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

## Environment

All deployment-specific configuration belongs in `.env`; `.env` is ignored by Git. The complete variable list is in `.env.example`:

| Group    | Variables                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Runtime  | `NODE_ENV`, `PORT`, `APP_URL`, `API_URL`, `VITE_API_URL`, `SESSION_SECRET`                           |
| Database | `DATABASE_URL`, `REDIS_URL`                                                                          |
| OAuth    | `GOOGLE_*`, `DISCORD_*`                                                                              |
| Email    | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME` |
| Admin    | `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                                                      |
| Storage  | `GOOGLE_DRIVE_*`, `BUNNY_*`                                                                          |
| Limits   | `FREE_*`, `PREMIUM_*`, `MAX_UPLOAD_SIZE`, `MAX_IMAGE_SIZE`, `MAX_DOCUMENT_SIZE`                      |
| Security | cookie, CSRF, rate limit, logging, verification, domain policy variables                             |

`SESSION_SECRET` must be a random value of at least 32 characters. `ADMIN_PASSWORD` is only read by the seed command, is never stored as plaintext, and must be kept outside source control.

## Production deployment

1. Provision PostgreSQL and Redis with private network access.
2. Set all required production environment variables, including a secure session secret, secure cookies, SMTP, and at least one storage provider.
3. Build and deploy the API and worker separately from the static web image:

   ```bash
   docker compose build
   docker compose run --rm api npx prisma migrate deploy
   docker compose run --rm api npm run db:seed
   docker compose up -d
   ```

4. Put TLS termination and a reverse proxy in front of the web and API. Set `COOKIE_SECURE=true`, `APP_URL` to the HTTPS web origin, and the API CORS origin to that same origin.
5. Run the API and worker under a process supervisor if not using Docker. The worker must remain running for warranty notifications, email, storage migration, reports, cleanup, and reconciliation jobs.
6. Back up PostgreSQL automatically, retain backups according to policy, and test restores. Provider files are treated as recoverable objects; metadata and checksums remain authoritative in PostgreSQL.

## Provider setup

- [Google OAuth and Discord OAuth](docs/oauth.md)
- [SMTP and Google Drive](docs/providers.md)
- [Operations, backups, and security](docs/operations.md)

OAuth tokens and Drive refresh tokens are server-side only. The React application never receives provider credentials or permanent provider URLs.

## Security model

Authentication uses opaque random tokens stored only as SHA-256 hashes in PostgreSQL. Auth cookies are HttpOnly, Secure in production, and SameSite=Lax by default. Mutating authenticated requests require a double-submit CSRF token bound to the server session. Every inventory and storage query scopes through the authenticated server session; client-provided `userId`, plan, role, or subscription fields are ignored.

Uploads are held in memory only for validation, checked by file signature, constrained by size and image pixel limits, assigned provider-generated storage keys, and never served from an executable web root. Supported types are JPG, PNG, WEBP, and PDF. SVG, HTML, scripts, executables, extension spoofing, path traversal, and unknown signatures are rejected.

## Current external configuration requirements

Google OAuth, Discord OAuth, SMTP, and Google Drive require provider credentials. Bunny is optional and disabled by default. Payment processing is intentionally represented by the subscription and entitlement services but is not activated until a future Stripe provider is configured.
