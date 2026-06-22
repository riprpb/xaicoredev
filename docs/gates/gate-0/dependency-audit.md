# Gate 0 Dependency Audit

**Date:** 2026-06-22

**Command:** `npm audit --audit-level=high`

**Result:** PASS

**Known vulnerabilities:** 0

## Reproducibility

- Clean install command: `npm ci --ignore-scripts`
- Lockfile: `package-lock.json`
- Node used for verification: `v24.15.0`
- npm used for verification: `11.12.1`

## Material Runtime Versions

- React `18.3.1`
- Express `4.22.2`
- Prisma Client `5.22.0`
- PostgreSQL client `8.22.0`
- Helmet `8.2.0`
- Express Rate Limit `8.5.2`
- Axios `1.18.0`

## Material Tooling Versions

- TypeScript `5.9.3`
- Vite `8.0.16`
- Vitest `4.1.9`
- ESLint `8.57.1`

ESLint 8 is end-of-life but did not produce a known audit vulnerability. Its supported
flat-config migration remains an outstanding Gate 1 foundation task.
