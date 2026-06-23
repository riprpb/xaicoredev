# XAICore Platform

**Primary repository:** `xaicoredev`

XAICore is in Gate 0 stabilization. The active application is a React/Vite frontend,
an Express API scaffold, a PostgreSQL/Prisma schema draft, and contract-only platform
foundations. Business AI, billing, KYC, wallet, trading, and blockchain features are
not implemented or enabled.

## Verified Capabilities

- Static platform overview page.
- Public API identity and health endpoints.
- Standard component manifest and lifecycle contracts.
- AI Registry contract and registration validation foundation.
- Memory Engine, AI Provider Gateway, Trust Gateway, and feature flag contracts.
- Secure API defaults for CORS, headers, rate limits, request size, correlation IDs,
  and internal error handling.

## Development

Requirements: Node.js 20.19 or newer, npm 9 or newer, and PostgreSQL for future
database-backed work.

```powershell
npm ci --ignore-scripts
npm run type-check
npm run lint
npm test
npm run build
npm run dev:full
```

See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for configuration details.

## Documentation

- [Documentation index](docs/README.md)
- [Platform architecture](docs/architecture/platform-overview.md)
- [Repository structure](docs/architecture/repository-structure.md)
- [Architecture decisions](docs/adr/README.md)
- [Phase Zero assessment](docs/assessment/phase-zero-platform-assessment.md)

Historical source and documents are preserved under `legacy/`, `archive/`, `backups/`,
and `docs/reference/`. Historical claims do not establish production readiness.

XAICore Platform - Proprietary. All rights reserved.
