# Gate 1 Implementation Plan

**Status:** Proposed; Owner approval required  
**Objective:** Kernel and identity foundation  
**Business features:** Explicitly out of scope

## Gate 1 Outcome

Deliver one secure, migration-backed vertical slice in which the Owner can authenticate,
view platform status, exercise a narrowly defined privileged action, and verify that
authorization denials and successful actions create trustworthy audit records.

## Workstream 1: Configuration and Secrets

- Define a typed configuration schema with startup validation.
- Separate public configuration, sensitive configuration references, and secrets.
- Define development, test, staging, and production profiles.
- Fail startup when required production values are missing or unsafe.
- Select the production secret-management provider after deployment-target approval.

## Workstream 2: Constitutional Identity Model

- Separate constitutional authority roles from subscription and product entitlements.
- Model Owner bootstrap as a one-time, auditable operation.
- Model designated successor grants with scope, activation conditions, expiry,
  revocation, version, and cryptographic protection.
- Implement users, credentials, sessions, devices, MFA factors, recovery methods, and
  session revocation.
- Define password hashing parameters, credential upgrades, brute-force controls, and
  secure recovery policy.

## Workstream 3: Permission Engine

- Define resources, actions, policy decisions, and explicit deny behavior.
- Enforce Owner hierarchy without hard-coded email, username, or confirmation strings.
- Separate shutdown, restart, restore, deployment, and policy-change permissions.
- Add middleware that authenticates first and authorizes every privileged operation.
- Build a permission matrix and denial-path tests before UI controls.

## Workstream 4: Audit and Observability

- Store append-only audit events with actor, constitutional authority, action, target,
  reason, decision, result, timestamp, correlation ID, and integrity metadata.
- Establish structured logs with redaction and stable event names.
- Add health, readiness, liveness, version, dependency, and metrics contracts to the
  active API.
- Define alert and retention requirements without collecting unnecessary user data.

## Workstream 5: Database Baseline

- Review and replace the draft Prisma schema with Tier 1 foundation models only.
- Create and test the initial PostgreSQL migration.
- Add Prisma client lifecycle and repository abstractions.
- Define transaction, Decimal, timestamp, soft-delete, retention, and idempotency rules.
- Add disposable database integration tests and migration verification in CI.

## Workstream 6: Persistent Platform Registries

- Persist standard manifests and registration records.
- Authorize and audit Registry mutations through the Kernel.
- Add Service Registry interfaces using the same manifest foundation.
- Persist feature-flag configuration and audit changes while preserving secure defaults.
- Keep all AI agents disabled and offline.

## Workstream 7: Owner Operations Slice

- Provide authenticated Owner sign-in and secure session management.
- Display API, database, Registry, and configuration health.
- Allow one reversible, non-destructive feature-flag action.
- Require a reason and re-authentication for the privileged action.
- Show the resulting audit event to the Owner.

## Security Validation

- Threat model identity, sessions, successor grants, authorization, audit integrity,
  configuration, and feature-flag changes.
- Test credential abuse, privilege escalation, session fixation, CSRF, replay,
  enumeration, rate-limit behavior, audit tampering, and secret leakage.
- Run static analysis, dependency audit, secret scanning, migration tests, API tests,
  and recovery tests in CI.

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
- Updated API, database, security, operations, deployment, and ADR documentation.
- Staging evidence and rollback plan.
- Owner approval before Gate 2 or any business feature.

## Owner Decisions Needed Before Gate 1 Starts

1. Confirm `xaicoredev/` as the independent Git repository root.
2. Select the initial deployment provider and production region.
3. Approve the constitutional Owner bootstrap and successor-recovery ceremony.
4. Approve whether local credentials are supported initially or an external identity
   provider is required.
5. Approve PostgreSQL hosting and backup requirements.
