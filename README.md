# KillByte Platform

KillByte is a production-oriented Next.js application with PostgreSQL persistence, authenticated real-time chat, granular administration, localization, rewards, referrals, memberships, verified finance workflows, support operations, automation, and a monochrome enterprise interface.

The rebuild intentionally excludes attack, takedown, and denial-of-service modules. It does not seed fake users, fake conversations, synthetic online counts, invented revenue, or fabricated analytics.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion, Lucide, and Recharts
- PostgreSQL 16+ with Prisma migrations and generated client
- Redis 7 for cross-process chat publication; a single-process local broadcast remains available when Redis is not configured
- A custom Node.js HTTP server that runs Next.js and authenticated WebSockets together
- A separate durable worker for automations and scheduled maintenance
- Docker and Docker Compose deployment assets
- `next-intl`, twenty initial locales, database-published translation overrides, dynamic administrator-added languages, and RTL support

## Security and data integrity

- Passwords use bcrypt.
- Sessions are opaque random values; only SHA-256 hashes are stored.
- Session cookies are HTTP-only, SameSite=Lax, and Secure in production.
- Login attempts are persisted and throttled.
- Optional TOTP MFA uses RFC 6238 codes, one-time hashed recovery codes, and an MFA-verified session state.
- Sensitive routes and server actions enforce role permissions on the server.
- Financial state changes use database transactions and append-only ledger entries.
- Payment webhooks are signature-verified and idempotent; browser payment confirmation is never trusted.
- Automation webhooks require HTTPS, an exact host allowlist, public IP resolution, standard ports, bounded payloads and headers, timeouts, and no redirects.
- Automation deliveries carry deterministic per-action idempotency keys. Internal notification and badge actions are checkpointed transactionally. External email and webhook integrations must also honor their received idempotency key because network delivery remains at-least-once.
- Administrator-controlled popup HTML is sanitized before storage.
- Sensitive operations create audit records.

## Requirements

- Node.js 22.12 or newer
- PostgreSQL 16 or newer
- Redis 7 or newer when running more than one web process
- npm 10 or newer
- Docker 24+ and Docker Compose for the provided container deployment

## Environment

Copy `.env.example` to `.env` and provide real values:

```bash
cp .env.example .env
```

At minimum set:

```bash
APP_URL=https://your-domain.example
NEXT_PUBLIC_APP_URL=https://your-domain.example
DATABASE_URL=postgresql://killbyte:strong-password@postgres:5432/killbyte?schema=public
REDIS_URL=redis://redis:6379
```

Optional provider configuration:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `OXAPAY_API_KEY` and `OXAPAY_WEBHOOK_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`
- `AUTOMATION_WEBHOOK_ALLOWLIST`

The seed creates an owner only when both `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least twelve characters are provided. Rotate that password after first sign-in and enable MFA from the profile page.

## Local development

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

In a second terminal, run the durable worker:

```bash
npm run worker
```

Open `http://localhost:3000/en`.

## Verification

Run the complete static and unit suite:

```bash
npm run check
npm run lint
npm test
npx prisma validate
node --check server.mjs
node --check worker.mjs
bash -n scripts/backup.sh
bash -n scripts/restore.sh
npm run build
```

The unit suite covers bounded automation conditions and templates, webhook network restrictions, deterministic action identity, RFC 6238 TOTP vectors, Base32 handling, and recovery-code normalization.

### Browser tests

Install Playwright browsers once:

```bash
npx playwright install --with-deps chromium
```

Run the desktop and mobile smoke suite against an application connected to a test database:

```bash
E2E_OWNER_EMAIL=owner@example.test \
E2E_OWNER_PASSWORD='a-long-test-password' \
npm run test:e2e
```

The browser suite verifies the landing page, security page, database-enabled RTL routing, owner sign-in, live dashboard and admin loading, and authenticated chat delivery. It creates one real chat message in the test database; it does not create mock success states.

## Docker deployment

Create a Compose environment file containing at least:

```bash
POSTGRES_PASSWORD='use-a-long-random-secret'
APP_URL=https://your-domain.example
NEXT_PUBLIC_APP_URL=https://your-domain.example
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD='use-a-long-random-password'
```

Build and start:

```bash
docker compose --env-file .env up -d --build
```

Services:

- `postgres`: persistent PostgreSQL with health checks
- `redis`: persistent Redis with append-only storage
- `migrate`: applies migrations and runs the idempotent seed
- `web`: Next.js plus authenticated WebSockets on port 3000
- `worker`: automation and scheduled maintenance process

Check service state and logs:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f worker
```

The web health endpoint queries PostgreSQL directly:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

## Backup and restore

Backup scripts use PostgreSQL custom-format archives and SHA-256 checksums.

Create a backup:

```bash
DATABASE_URL='postgresql://user:password@host:5432/killbyte' \
BACKUP_DIR=/secure/backups \
./scripts/backup.sh
```

Restore only after taking a fresh pre-restore backup and confirming the target database:

```bash
RESTORE_CONFIRM=RESTORE \
DATABASE_URL='postgresql://user:password@host:5432/killbyte' \
./scripts/restore.sh /secure/backups/killbyte-YYYYmmdd-HHMMSS.dump
```

## Worker operations

The worker processes due automation executions atomically. Retrying work receives exponential backoff and a bounded attempt count. Stale running leases are recovered instead of being reported as successful.

Supported automation side effects are deliberately limited:

- in-app notifications
- email
- enabled badge assignment
- explicitly allowlisted HTTPS webhooks

Test-mode executions validate configuration without external delivery. Scheduled queues cover subscription, session, deposit, badge, and moderation expiration, plus bounded login-attempt and analytics cleanup.

For email and webhooks, retries include a stable `X-KillByte-Idempotency-Key` / `Idempotency-Key`. Receiving systems should record that key and suppress duplicate processing after an uncertain response.

## Production operations

- Place HTTPS and trusted proxy headers in front of the web process.
- Keep `DATABASE_URL`, OAuth secrets, payment credentials, and SMTP credentials out of the browser and version control.
- Run at least one worker; multiple workers can share the queue safely.
- Use Redis when more than one web instance serves chat.
- Monitor `/api/health`, worker structured logs, PostgreSQL connections, disk space, Redis memory, and scheduled-job `lastRunAt` values.
- Set `LOG_LEVEL=info` or `warn` in production.
- Keep database backups encrypted, access-restricted, and regularly restore-tested.
- Review audit logs and login attempts after every privileged configuration change.

## Dependency audit note

The production dependency audit currently leaves only the upstream `picomatch` advisory reachable through `@parcel/watcher`/`next-intl`; no fixed `picomatch` release is available at the time this source was locked. Re-run `npm audit --omit=dev` during maintenance windows and update when upstream publishes a fix. Development-only audit findings should be reviewed separately from the deployed runtime.

## Operational boundaries

KillByte does not include third-party attack, takedown, or denial-of-service capability. Performance or diagnostic testing must be limited to infrastructure owned by the operator or explicitly authorized in writing, with documented scope, rate limits, audit records, and an emergency stop process.
