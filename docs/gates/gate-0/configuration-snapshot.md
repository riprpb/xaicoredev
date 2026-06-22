# Gate 0 Configuration Snapshot

This snapshot records configuration shape, never secret values.

## Runtime

- Default environment: `development`
- Default API host: `127.0.0.1` when not otherwise configured
- Default API port: `3000`
- Default development CORS origin: `http://localhost:5173`
- Default rate limit: 100 requests per 900,000 ms
- Request body limit: 1 MB
- Production requires explicit `CORS_ALLOWED_ORIGINS`

## Environment Variable Names

Database: `DATABASE_URL`.

Server: `NODE_ENV`, `PORT`, `HOST`, `API_PORT`, `API_HOST`, `API_RATE_LIMIT`,
`API_RATE_WINDOW_MS`, `CORS_ALLOWED_ORIGINS`.

Frontend: `VITE_API_URL`.

Reserved future integrations include provider, email, storage, authentication,
blockchain, analytics, and feature variables shown as placeholders in `.env.example`.
They are not proof of active integration.

## Secret Handling

- `.env.local` is ignored.
- Secret values are absent from this snapshot.
- Provider adapters and secret-management services are not implemented.
