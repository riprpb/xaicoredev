# Gate 0 Build Results

**Date:** 2026-06-22

**Result:** PASS

| Check | Command | Result |
| --- | --- | --- |
| Clean install | `npm ci --ignore-scripts` | PASS |
| TypeScript | `npm run type-check` | PASS |
| Lint | `npm run lint` | PASS |
| Prisma schema | `npx prisma validate` | PASS |
| Production build | `npm run build` | PASS |
| API normal mode | `npm run server` plus `/api/health` | PASS |
| API watch mode | `npm run server:watch` plus `/api/health` | PASS |

## Production Build Snapshot

- Vite: `8.0.16`
- Modules transformed: 19
- HTML: 1.27 kB, 0.65 kB gzip
- CSS: 2.53 kB, 1.06 kB gzip
- JavaScript: 360.43 kB, 111.59 kB gzip

Generated `dist/` content is excluded from Git. The source, lockfile, and build
configuration are the reproducible record.
