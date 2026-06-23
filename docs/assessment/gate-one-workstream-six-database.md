# Gate 1 Workstream 6 Verification

**Workstream:** 6 - Database Baseline  
**Status:** IMPLEMENTED - live PostgreSQL verification pending  
**Assessment date:** 2026-06-22

## Implemented

- Foundation-only Prisma schema with all prohibited draft business models removed.
- Version-controlled initial PostgreSQL migration.
- Database constraints for singleton Owner bootstrap, one active Owner authority,
  positive versions, valid expiry ordering, idempotency expiry, and audit hashes.
- Mutation-blocking triggers for immutable Owner and append-only audit records.
- Opaque Kernel identifier persistence without false UUID assumptions.
- Lazy Prisma client lifecycle and bounded serializable transactions.
- Identity, audit, idempotency, and transaction repository contracts.
- Canonical Decimal, UTC timestamp, soft-delete, and idempotency policies.
- Disposable PostgreSQL CI service, migration deployment, and integration tests.
- Provider-neutral backup and recovery requirements.

## Local Verification

- `prisma validate`: PASS.
- `prisma generate`: PASS.
- Static migration invariant tests: PASS.
- Database policy tests: PASS.
- Database unit coverage: 100% statements, branches, functions, and lines.
- Type checking and lint: PASS.
- Live PostgreSQL migration: NOT RUN - no Docker, `psql`, or PostgreSQL service exists
  on this workstation.
- Live rollback, trigger, and singleton tests: PENDING CI or approved development
  PostgreSQL.
- Restore exercise: BLOCKED - hosting and backup provider are not selected.

## Architecture Review

ADR-0003 already establishes PostgreSQL and Prisma. No new ADR is required for the
baseline implementation. Selecting hosting, region, backup retention, or production
recovery parameters requires Owner approval and may require a provider-specific ADR.

Workstream 6 must not be marked fully verified until its migration and integration test
run succeeds against disposable PostgreSQL. Production remains separately gated.
