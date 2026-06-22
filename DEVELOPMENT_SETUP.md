# XAICore Development Setup

## Requirements

- Node.js 20.19 or newer.
- npm 9 or newer.
- PostgreSQL for database-backed Gate 1 work.

## Install and Verify

```powershell
npm ci --ignore-scripts
npm run type-check
npm run lint
npm test
npm run build
```

Copy `.env.example` to `.env.local` for local execution and replace placeholders with
local values. Never commit `.env.local` or print secret values in logs.

Prisma reads `DATABASE_URL` from the process environment or a root `.env` file. The
application uses `.env.local`, so export the value before invoking Prisma directly:

```powershell
$env:DATABASE_URL = '<local-postgresql-url>'
npx prisma validate
```

## Run

```powershell
npm run dev       # frontend at http://localhost:5173
npm run server    # API at the configured API_HOST and API_PORT
npm run dev:full  # both processes
```

The development API defaults to `127.0.0.1:3000`, allows only
`http://localhost:5173`, limits API requests, and caps JSON bodies at 1 MB.

## Active Boundaries

Only active source under `src/` participates in type checking, linting, tests, and
builds. Do not import directly from `legacy/`, `archive/`, or `backups/`.

## Database

`prisma/schema.prisma` is a draft and no Gate 1 migration baseline has been approved.
Do not run production migrations or collect user data. Once Gate 1 begins, all schema
changes will use version-controlled Prisma migrations.

## Documentation

Significant decisions require an ADR under `docs/adr/`. Update architecture, API,
database, security, deployment, or operations documentation in the same change as the
implementation.
