# Production operations

## Backups

PostgreSQL is the source of truth for users, ownership records, permissions, object metadata, checksums, activity, and job state. Use automated encrypted PostgreSQL backups with a documented retention period and test a restore at least quarterly. Provider objects should be protected with provider versioning/redundancy where available.

## Workers

The worker consumes Redis-backed BullMQ queues. Jobs are designed around idempotent database keys and retryable provider operations. Monitor failed jobs, queue depth, retry counts, and warranty notification delivery. Do not run the worker with a different database or encryption configuration than the API.

## Logs and events

Structured logs include request IDs and redact cookies, tokens, passwords, and secrets. Security events cover authentication, password resets, OAuth, administrator actions, suspicious activity, and rate limits without collecting unnecessary personal data.

## Incident response

Rotate `SESSION_SECRET` to invalidate all sessions after a suspected session compromise. Revoke OAuth and storage credentials at the provider, rotate SMTP/API secrets, inspect `SecurityEvent` and `AdminAuditLog`, and verify PostgreSQL restore points. Never place credentials, uploads, or generated private reports in Git.
