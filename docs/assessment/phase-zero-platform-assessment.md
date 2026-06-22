# XAICore Phase Zero Platform Assessment

**Assessment date:** 2026-06-22  
**Status:** Architecture review complete; implementation approval pending  
**Scope:** Current workspace, active application, preserved legacy source, schemas,
configuration, documentation, tests, dependencies, and repository state

## Executive Summary

XAICore is not production-ready. The current workspace contains two materially
different codebases:

1. A small, coherent React/Vite/Express/Prisma scaffold under `src/` that builds
   successfully but implements only a landing page and two public API endpoints.
2. A large, flat legacy export containing many feature concepts, UI prototypes,
   schemas, and service fragments. It is not integrated, has missing dependencies
   and directories, mixes incompatible architectures, contains exact duplicates,
   and has syntax and quality failures.

The safest and shortest path to launch is to preserve the active scaffold, establish
a clean repository and governance baseline, then implement the Tier 1 platform as
small vertical slices. The legacy export should be treated as reference material and
selectively recovered only after review; it must not be copied wholesale into the
active application.

The immediate priority is not Haley, Scarlett, trading, wallet, or blockchain. The
immediate priority is a secure platform foundation: version control, configuration,
database migrations, Kernel boundaries, identity, Owner authority, authorization,
audit logging, and a testable deployment pipeline. Revenue features can then be
built on that foundation without creating another rewrite.

## Assessment Method

The review included:

- Repository and Git state inventory.
- Full review of the active `src/` application and active configuration.
- Review of Prisma schema and environment-variable shape without printing secrets.
- Static inventory and targeted inspection of the legacy TypeScript/TSX/SQL files.
- Exact-hash duplicate detection at the repository top level.
- Import, path, database-technology, security, TODO, and test discovery scans.
- Review of current Markdown project documents and archive context.
- Locked dependency installation using `npm ci --ignore-scripts`.
- Type checking, production build, lint, tests, Prisma validation, and dependency
  vulnerability audit.
- Archive entry-name inspection for obvious secret-bearing files.

Binary documents, images, database editor state, and compressed source archives were
inventoried but not treated as authoritative executable source. The two large ZIP
archives contain 425 and 228 entries respectively. The preserved backup directory is
a duplicate source snapshot, not an independently maintained application.

## Repository Status

### Critical Findings

- The Git root is `Xaicoredev_platform`, two levels above this application.
- The repository has no commits on `master`; the entire platform and neighboring
  files are untracked.
- The user's global Git configuration contains an invalid line, so normal Git
  commands fail unless the global config is bypassed.
- The application directory contains more than 600 MB, mostly from two approximately
  300 MB ZIP archives and duplicated source material.
- Expected top-level architecture directories such as `kernel`, `services`, `ai`,
  `modules`, `infrastructure`, `tests`, `database`, and `config` do not exist.
- The governing Constitution, Architecture Manual, Engineering Standards, and Roadmap
  supplied during this review are not yet versioned in the repository.

### Duplicate and Archive Debt

At least 18 exact duplicate groups exist in the top-level legacy source, including:

- `BrowserAutomation.tsx` / `BrowserAutomation2.tsx`
- `client.ts` / `client2.ts`
- `contracts.ts` / `contracts2.ts`
- `file_generator.ts` / `file_generator2.ts`
- `incident_schema.ts` / `incident_schema2.ts` / `incident_schema3.ts`
- `subscription_service.ts` / `subscription_service2.ts`
- `walletSecurityMonitor.ts` / `walletSecurityMonitor2.ts`

The `xaicore dev PC Files/Latest Xaicoredev everything - Copy` directory duplicates
most of the legacy export again. This makes linting, testing, discovery, and ownership
ambiguous and materially increases the risk of editing the wrong implementation.

## Active Application Status

### Verified Working

- React 18 and Vite frontend entry point.
- One public route rendering a static XAICore landing page.
- Express server startup.
- `GET /api` and `GET /api/health` public endpoints.
- Axios API client wrapper.
- PostgreSQL Prisma schema syntax, when `DATABASE_URL` is explicitly loaded.
- TypeScript type check for `src/`.
- Production frontend build.

### Verified Missing

- System Kernel implementation.
- Owner and successor authority model.
- Authentication, sessions, password flows, MFA, and account recovery.
- Authorization and permission engine.
- User account APIs and UI.
- KYC workflow, provider abstraction, consent, retention, and audit controls.
- AI Registry, Service Registry, Memory Registry, and Asset Registry.
- Event Bus.
- Structured logging, correlation IDs, audit engine, and metrics.
- Configuration service, feature flags, encryption service, and secret manager.
- Database client integration and migration history.
- Haley, Scarlett, Production AI, or any operational AI runtime.
- Subscription, Stripe checkout, webhook processing, invoicing, or entitlements.
- Deployment, CI, staging, backup, recovery, or Infrastructure as Code.
- Active application tests.

### Active Quality Results

| Check | Result | Notes |
| --- | --- | --- |
| Type check | Pass | `npm run type-check` |
| Production build | Pass | 35 modules; frontend bundle produced |
| Active lint | Fail | 2 errors in `src/` |
| Active tests | Fail | No test files under `src/` |
| Prisma schema | Pass with manual env load | Prisma does not load `.env.local` automatically |
| Repository lint | Fail | 1,054 findings, including syntax errors |
| Repository tests | Fail | Test discovery includes backups and `.codex` cache |
| Dependency audit | Fail | 12 findings: 3 critical, 5 high, 4 moderate |

## Architecture Assessment

### Active Architecture

The active application is a conventional single-package TypeScript scaffold. This is
appropriate for an MVP if it is organized as a modular monolith with explicit module
boundaries. Independently deployable microservices are not justified yet and would
slow launch while increasing operational risk.

Recommended initial runtime boundaries:

- `apps/web`: React experience layer.
- `apps/api`: API composition and transport.
- `packages/kernel`: identity context, authorization, registries, audit contracts,
  lifecycle contracts, configuration contracts, and event interfaces.
- `packages/database`: Prisma client, schema, migrations, and repositories.
- `modules/*`: cohesive business modules such as accounts, KYC, billing, Haley,
  Scarlett, and Production.
- `packages/shared`: narrow cross-platform types and utilities.

These can remain in one deployable application initially while preserving interfaces
that allow later extraction when scale or team ownership requires it.

### Legacy Architecture

The legacy export is not compatible with the active application without substantial
rework:

- It primarily expects MySQL and Drizzle while the active scaffold uses PostgreSQL
  and Prisma.
- It references absent `_core`, `drizzle`, `webhooks`, component, hook, and tRPC
  directories.
- It imports uninstalled packages such as tRPC, Drizzle, Playwright, Wouter, Sonner,
  Lucide, and UI component libraries.
- Several source files contain parsing errors or incomplete JSX.
- Some comments explicitly describe operations as TODOs while associated documents
  claim the feature is complete.
- Root `index.ts` references a Stripe webhook module that does not exist.
- The legacy test named `main.test.tsx` is not a test and imports a missing file.
- API-key tests perform live third-party calls and require real secrets, making them
  unsuitable as deterministic automated tests.

Legacy code should pass a per-feature salvage checklist before reuse: ownership,
security, dependency validity, architecture fit, behavior tests, data model mapping,
and licensing/provenance.

## Security and Trust Assessment

### Critical Risks

1. **No security boundary exists in the active API.** All current endpoints are
   public, and there is no authenticated request context or authorization layer.
2. **Owner authority is not implemented.** The Prisma role enum contains only
   `ADMIN`, `USER`, and `PREMIUM`; it cannot express Owner or successor authority.
3. **Legacy authority checks are unsafe.** Preserved code hard-codes an Owner ID and
   a fixed emergency confirmation phrase. Neither is a cryptographic authorization
   control.
4. **Configured secrets exist locally.** `.env.local` contains configured database,
   JWT, session, AI-provider, Stripe, blockchain, and wallet values. The file is
   ignored by the nested `.gitignore`, but the abnormal Git root and uninitialized
   repository require careful verification before the first commit. No secret values
   were printed during this assessment.
5. **Dependency vulnerabilities block release.** The full dependency audit reports
   3 critical, 5 high, and 4 moderate vulnerabilities. Production-only audit reports
   4 high and 1 moderate finding, including vulnerable WebSocket dependency paths.
6. **No audit engine exists.** Constitutional requirements for explainable and
   auditable privileged actions are not met.

### High Risks

- Express uses unrestricted CORS defaults.
- Request body limits are not explicitly constrained.
- No security headers, rate limiting, CSRF strategy, session policy, or brute-force
  protection exists.
- The error handler returns `err.message`, potentially exposing internal details.
- Logging uses unstructured console output and has no correlation IDs or redaction.
- Password storage is represented by a plain `password` field with no documented hash
  policy, credential versioning, or breach-response design.
- Prisma migrations are ignored by `.gitignore`, directly conflicting with the
  migration-driven database standard.
- No data retention, deletion, export, consent, KYC privacy, or regional compliance
  model exists.
- No backup, restore test, disaster recovery, or incident-response implementation
  exists.

### Secret and Archive Review

Pattern scanning found no obvious live key literal in tracked-style source files.
Archive entry names did not reveal `.env`, credential, or private-key files. This is
not proof that archive contents are secret-free; a dedicated secret scanner should
run before any import or publication.

## Database Assessment

The active Prisma schema is syntactically valid and provides a useful starting point,
but it is not sufficient for launch:

- No migrations are present or versioned.
- No Prisma client is instantiated in the active server.
- `Subscription` lacks a declared relation to `User` despite storing `userId`.
- Authorization, organizations, sessions, devices, MFA, successors, permissions,
  audit events, KYC cases, consent, billing events, entitlements, registries, service
  health, lifecycle state, and idempotency records are absent.
- Financial amounts use Prisma `Decimal`, while frontend types reduce them to JavaScript
  `number`, which is unsafe for money without a defined serialization policy.
- Blockchain and wallet models are prematurely present relative to the approved build
  order and should not drive the foundation schema.
- The `.env.example` uses a SQLite URL while Prisma is configured for PostgreSQL.
- Setup documentation and package scripts refer to migration and seed paths that do
  not exist.

One database technology and migration strategy must be selected before feature work.
The current recommendation is PostgreSQL plus Prisma for the MVP because that is the
coherent active path.

## Documentation Assessment

Current documentation has useful historical context but is not synchronized with the
code:

- README and setup documents describe features and directories that do not exist.
- Encoding corruption is visible in several imported Markdown files.
- `AGENT_BUILD_SUMMARY.md` labels unintegrated fragments as built and complete.
- `PROJECT_CONTEXT_FROM_ARCHIVE.md` is the most accurate existing status document and
  correctly warns that archive implementation claims require verification.
- No versioned Constitution, architecture manual, engineering standards hierarchy,
  ADR directory, security policy set, or operational runbooks exist in the repo.

Documentation claims must be changed from feature marketing to evidence-based states:
`planned`, `prototype`, `integrated`, `tested`, `staged`, or `production`.

## Tier 1 Readiness

| Tier 1 capability | Status |
| --- | --- |
| System Kernel | Missing |
| Authentication | Missing |
| Owner hierarchy | Missing |
| Haley AI | Legacy prototype only |
| Scarlett AI | Legacy prototype only |
| Production AI | Missing as an integrated system |
| Subscription billing | Legacy fragments only |
| Payments | Dependency present; implementation missing |
| KYC foundation | Legacy fragments only |
| Security foundation | Missing in active app |
| Database | Schema draft only |
| Logging and audit | Missing |

No Tier 1 feature qualifies as complete under the supplied Definition of Done.

## Recommended Implementation Strategy

### Gate 0: Repository Recovery and Governance

Objective: create a trustworthy engineering baseline before product work.

- Confirm the intended Git root and initialize history at the correct scope.
- Repair or intentionally bypass the broken global Git configuration.
- Quarantine legacy exports, backups, editor databases, and archives outside the
  active source tree while preserving them read-only.
- Commit normalized governing documents under `docs/`.
- Define authoritative status vocabulary and remove unsupported completion claims.
- Add deterministic ESLint, Vitest, and TypeScript include/exclude boundaries.
- Version Prisma migrations; stop ignoring them.
- Add CI for install, type check, lint, unit tests, build, dependency audit, and secret
  scanning.
- Resolve critical/high dependency vulnerabilities or remove unused dependencies.

**Exit criteria:** clean initial history, reproducible CI, zero critical/high known
dependency findings or approved documented exceptions, and no ambiguous active source.

### Gate 1: Kernel and Identity Foundation

Objective: establish constitutional authority and secure platform primitives.

- Implement typed configuration validation and secret references.
- Define immutable constitutional roles separately from commercial subscription roles.
- Implement Owner bootstrap, successor grants, least-privilege permissions, and
  separation of shutdown from reboot authority.
- Implement accounts, credential hashing, sessions, device records, MFA foundation,
  recovery, and session revocation.
- Implement authorization middleware and policy tests.
- Implement append-only audit events with actor, authority, reason, correlation ID,
  target, result, timestamp, and integrity metadata.
- Add structured logging, redaction, health/readiness/liveness endpoints, metrics, and
  error contracts.
- Establish service, AI, and lifecycle manifest schemas before implementing AI agents.

**Exit criteria:** Owner-controlled authenticated vertical slice with tested permission
denials, audited privileged actions, migration-backed storage, and operational health.

### Gate 2: Accounts, KYC, Billing, and Revenue Primitives

Objective: provide the secure commercial foundation shared by all revenue products.

- User profile, organization, privacy, device, session, and security settings.
- Graduated trust levels and KYC case orchestration through a provider abstraction.
- Consent, retention, data minimization, review, appeal, and audit controls.
- Central plan catalog, entitlements, usage metering, trials, subscriptions, invoices,
  refunds, and webhook event storage.
- Stripe adapter with verified signatures, idempotency, replay protection, and test
  mode integration tests.

**Exit criteria:** a verified user can purchase a plan, receive entitlements, manage
the subscription, and produce a complete auditable record in staging.

### Gate 3: Revenue Products

Objective: launch narrow, valuable versions of Haley, Scarlett, and Production AI.

- Haley first as an authenticated orchestration interface over registered capabilities,
  not as infrastructure authority.
- Scarlett as a policy-controlled conversational product using centralized accounts,
  entitlements, memory permissions, and billing.
- Production AI as a small provider-abstracted generation workflow with asset ownership,
  job state, cost controls, and auditability.
- Build only the smallest paid workflows that can be supported reliably.

**Exit criteria:** end-to-end paid workflows, support procedures, usage limits, cost
visibility, safety controls, and staging-to-production approval evidence.

### Gate 4: Trust and Core Expansion

Implement Hope Shield, Hope S, Hope Tech, wallet, marketplace, CRM, messaging, domains,
and hosting in dependency order after launch metrics demonstrate foundation stability.

### Gate 5: Regulated Financial Expansion

Trading, custody-like wallet behavior, XAC, smart contracts, and blockchain services
require separate legal, threat-model, key-management, financial-risk, and regulatory
approval. They must remain isolated from core platform availability.

## Architectural Decisions Requiring Owner Approval

1. **Repository boundary:** make `xaicoredev` the repository root, or retain the parent
   root as a deliberate monorepo.
2. **MVP topology:** approve a modular monolith as the launch architecture, with
   extraction-ready interfaces rather than immediate microservices.
3. **Primary data platform:** approve PostgreSQL plus Prisma and retire the MySQL/
   Drizzle legacy path from active development.
4. **Legacy disposition:** approve quarantine-and-salvage rather than wholesale merge.
5. **Initial revenue scope:** identify the single smallest paid Scarlett or Production
   workflow to launch after platform foundations.
6. **Identity/KYC vendors:** authorize a vendor evaluation after requirements, regions,
   data residency, and retention obligations are defined.
7. **Deployment target:** select the first cloud/runtime and production region before
   Infrastructure as Code is implemented.

## Immediate Recommendation

Approve Gate 0 only. It has the highest combined value for security, launch speed,
maintainability, and trust. Gate 0 should not implement business features; it should
produce a clean, reproducible platform baseline and a detailed Gate 1 design for Owner
approval.

No public launch, payment collection, KYC data collection, wallet operation, trading,
or production AI workflow should occur from the current repository state.

## Approval Requested

Owner approval is requested to begin **Gate 0: Repository Recovery and Governance**
using the recommendations above. Major architectural or product changes remain paused
until explicitly approved.
