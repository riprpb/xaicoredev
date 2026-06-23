# Gate 1 Implementation Plan

**Status:** Approved by Owner with final amendments on 2026-06-22
**Objective:** Kernel and identity foundation  
**Business features:** Explicitly out of scope

Gate 1 implementation is authorized in the workstream order below. Architectural
changes remain subject to the Constitution, accepted ADRs, Engineering Standards, and
Owner security directives.

## Gate 1 Outcome

Deliver one secure, migration-backed vertical slice in which the Owner can authenticate,
view platform status, exercise a narrowly defined privileged action, and verify that
authorization denials and successful actions create trustworthy audit records.

## Workstream 0: Haley Core Foundation

Haley Core is a platform monitoring service, not the complete Haley AI. Establish
read-only contracts and services for:

- Manifest and Registry awareness.
- Feature Flag awareness.
- Platform diagnostics and health aggregation.
- An executive dashboard backend.
- Repository and architecture reporting.
- Sanitized log aggregation.

Haley Core may detect, monitor, analyze, recommend, and request Owner approval. It may
not execute privileged operations or receive knowledge of private Root Authority and
emergency-control mechanisms. Business intelligence, legal reasoning, orchestration,
and advanced AI behavior remain deferred.

## Workstream 1: Configuration and Secrets

**Status:** Complete; verified 2026-06-22

- Define a typed configuration schema with startup validation.
- Separate public configuration, sensitive configuration references, and secrets.
- Define development, test, staging, and production profiles.
- Fail startup when required production values are missing or unsafe.
- Select the production secret-management provider after deployment-target approval.

The typed configuration, profile isolation, startup validation, visibility separation,
Kernel reader/validator, and coverage thresholds are implemented and verified. The
provider-specific production secret resolver remains intentionally deferred pending
the Owner's deployment-provider decision and does not block Workstream 1 completion.

## Workstream 2: Constitutional Identity Model

**Status:** Complete; verified 2026-06-22

- Separate constitutional authority roles from subscription and product entitlements.
- Model designated successor grants with scope, activation conditions, expiry,
  revocation, version, and cryptographic protection.
- Implement users, credentials, sessions, devices, MFA factors, recovery methods, and
  session revocation.
- Define password hashing parameters, credential upgrades, brute-force controls, and
  secure recovery policy.

The provider-neutral identity model, local credential policy, mandatory compromised-
password screening contract, session lifecycle and revocation, MFA assurance policy,
and recovery authorization policy are implemented and verified. Persistence and
Kernel Permission Engine integration remain in their approved later workstreams.

## Workstream 3: Owner Bootstrap

**Status:** Complete; verified 2026-06-22

- Record constitutional acceptance as a one-time, auditable operation.
- Establish the permanent Owner identity and cryptographic Owner identifier.
- Generate recovery keys through an Owner-controlled security ceremony.
- Establish the successor trust framework.
- Create an immutable ownership record and corresponding audit event.
- Prohibit any future administrator from recreating or replacing Owner bootstrap.
- Keep Root Authority and emergency-control implementation details within restricted
  internal security architecture, outside AI-readable contracts and user interfaces.

## Workstream 4: Permission Engine

**Status:** Complete; verified 2026-06-22

- Define resources, actions, policy decisions, and explicit deny behavior.
- Enforce Owner hierarchy without hard-coded email, username, or confirmation strings.
- Separate shutdown, restart, restore, deployment, and policy-change permissions.
- Add middleware that authenticates first and authorizes every privileged operation.
- Build a permission matrix and denial-path tests before UI controls.

The deny-by-default policy engine resolves constitutional authority and capabilities
through an identity-independent subject port. Owner-reserved operations require active
Owner authority, multi-factor assurance, fresh reauthentication, and a reason. The
authentication-first HTTP guard fails closed and exposes only generic denials.

## Workstream 5: Audit and Observability

**Status:** Complete; verified 2026-06-22

- Store append-only audit events with actor, constitutional authority, action, target,
  reason, decision, result, timestamp, correlation ID, and integrity metadata.
- Establish structured logs with redaction and stable event names.
- Add health, readiness, liveness, version, dependency, and metrics contracts to the
  active API.
- Define alert and retention requirements without collecting unnecessary user data.

The local append-only audit adapter uses a verified SHA-256 integrity chain and refuses
writes after detected tampering. Permission allows and denials are automatically
audited and fail closed when audit persistence fails. The active API exposes sanitized
health, readiness, liveness, version, dependency, and metrics evidence.

## Workstream 6: Database Baseline

**Status:** Implementation complete; live PostgreSQL verification blocked locally

- Review and replace the draft Prisma schema with Tier 1 foundation models only.
- Create and test the initial PostgreSQL migration.
- Add Prisma client lifecycle and repository abstractions.
- Define transaction, Decimal, timestamp, soft-delete, retention, and idempotency rules.
- Add disposable database integration tests and migration verification in CI.

The draft business schema was replaced with Tier 1 foundation models and a hardened
initial PostgreSQL migration. Prisma lifecycle, serializable transactions, repository
ports, Decimal/timestamp/soft-delete/idempotency policies, static migration tests, and
disposable PostgreSQL CI verification are implemented. This workstation has no Docker,
`psql`, or PostgreSQL service, so live migration and restore execution remain unverified
until CI or an Owner-approved development database is available.

## Workstream 7: Persistent Platform Registries

**Status:** Implementation complete; live PostgreSQL verification pending

- Persist standard manifests and registration records.
- Authorize and audit Registry mutations through the Kernel.
- Add Service Registry interfaces using the same manifest foundation.
- Keep all AI agents disabled and offline.

Versioned manifests and active Registry records are modeled persistently behind a
Kernel component port and Prisma repository. Mutations require a transaction and are
subject to the Kernel Permission/Audit chain. Database constraints keep every AI
execution-disabled and limited to offline, shutdown, or removed lifecycle states.

## Workstream 8: Registered Feature Flag Persistence

**Status:** Implementation complete; live PostgreSQL verification pending

- Register every feature flag through the persistent Registry architecture.
- Persist feature-flag configuration only after its Registry record exists.
- Authorize and audit changes while preserving secure defaults.
- Reject unknown, unregistered, or unavailable flags.

Feature Flag definitions require an active owning Registry record and database-enforced
secure false defaults. Environment values are versioned, reason-required, and mutated
only through a Kernel component port. Unknown, unavailable, retired, and unconfigured
flags evaluate disabled.

## Workstream 9: Owner Operations Slice

**Status:** Foundation implemented; live credential, MFA, and PostgreSQL activation pending

- Provide authenticated Owner sign-in and secure session management.
- Display API, database, Registry, and configuration health.
- Allow one reversible, non-destructive feature-flag action.
- Require a reason and re-authentication for the privileged action.
- Show the resulting audit event to the Owner.

The Kernel gateway, provider-neutral MFA Owner-session authentication, authenticated
Owner status service, CSRF-protected Feature Flag route, reason and reauthentication
policy, and correlated audit response are implemented and verified synthetically. The
routes remain unmounted by default. The create-once local password and encrypted TOTP
ceremonies are ready but have not been executed. Live activation still requires direct
Owner password entry, authenticator enrollment, and a verified PostgreSQL migration;
none is created automatically.

## Security Validation

**Status:** Implementation evidence recorded; live credential and PostgreSQL validation
pending

- Threat model identity, sessions, successor grants, authorization, audit integrity,
  configuration, and feature-flag changes.
- Test credential abuse, privilege escalation, session fixation, CSRF, replay,
  enumeration, rate-limit behavior, audit tampering, and secret leakage.
- Run static analysis, dependency audit, secret scanning, migration tests, API tests,
  and recovery tests in CI.

Security validation evidence is recorded in `docs/security/gate-one-security-validation.md`.
The remaining live items require direct Owner credential/MFA entry and an approved or
disposable PostgreSQL database.

## Explicitly Deferred

Haley, Scarlett, Production AI, provider adapters, business memory, KYC collection,
billing, payments, Trust Gateway scanners, Hope agents, marketplace, wallet, trading,
and XAC remain disabled.

## Exit Criteria

- Clean CI and zero unapproved critical/high dependency findings.
- Version-controlled migration and tested database recovery procedure.
- Owner authentication, MFA foundation, session revocation, and tested permission
  denials.
- No hard-coded Owner identity or authority secret.
- Audited privileged action with correlation across API, policy, and persistence.
- Persistent manifest/Registry foundation with all AI offline.
- Every persistent feature flag has an authoritative Registry record.
- Integrated Platform Validation proves the following components operate together:
  Kernel -> Registry -> Memory Engine -> Haley Core -> Owner Authentication ->
  Permission Engine -> Audit.
- Updated API, database, security, operations, deployment, and ADR documentation.
- Staging evidence and rollback plan.
- Owner approval before Gate 2 or any business feature.

## Owner Decisions Required Before Affected Workstreams

1. **Resolved 2026-06-22:** `xaicoredev/` is the approved primary repository name and
   independent Git repository root.
2. Select the initial deployment provider and production region.
3. Approve the constitutional Owner bootstrap and successor-recovery ceremony.
4. **Resolved 2026-06-22:** local credentials are approved for the initial development
   identity strategy. External identity providers remain future adapters.
5. Approve PostgreSQL hosting and backup requirements.

The Owner authorized Workstream 0 to begin on 2026-06-22. Decisions that are not yet
recorded remain blocking inputs for their affected infrastructure, identity, bootstrap,
and database workstreams.
