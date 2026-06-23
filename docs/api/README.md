# API Documentation

The Gate 1 API currently exposes these sanitized operational endpoints:

- `GET /api/health` - aggregate component and dependency health.
- `GET /api/health/ready` - readiness with HTTP 503 for required dependency failure.
- `GET /api/health/live` - process liveness.
- `GET /api/version` - application version and runtime profile.
- `GET /api/metrics` - non-sensitive in-process counter and gauge snapshot.

Correlation IDs, generic error envelopes, CORS controls, request-size limits, security
headers, and rate limiting are active. Authentication and authorization for Owner
operations are introduced in their approved later workstream. Production network
exposure and metrics access policy remain deployment decisions.

The Owner Operations adapter defines conditional routes for `GET /api/owner/status`
and `PUT /api/owner/feature-flags/:name`. They are mounted only when an approved Owner
session authenticator is supplied. Mutation requires an authenticated MFA Owner session,
fresh reauthentication, CSRF verification, an explicit reason, Kernel permission, and
audit persistence. No live Owner route is mounted in the default server configuration.
