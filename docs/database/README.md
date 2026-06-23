# Database Documentation

PostgreSQL and Prisma are the authoritative transactional data direction under
ADR-0003. Gate 1 contains only foundation identity, authentication, constitutional
authority, successor trust, immutable Owner, append-only audit, and idempotency models.
Wallet, trading, blockchain, business Brain, subscription, payment, and other business
models are prohibited from the baseline.

## Migration Workflow

All schema changes require a version-controlled migration. Direct production schema
changes and `prisma db push` are prohibited.

```powershell
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run db:migrate:status
```

CI starts disposable PostgreSQL, deploys every migration from an empty database, and
runs database integration tests. Production migration remains a separate deployment
authorization step.

## Transaction Rules

- Cross-repository writes use `PrismaClientLifecycle.transaction` with serializable
  isolation, bounded wait, and bounded execution time.
- Repository methods participating in a transaction receive the same Prisma transaction
  client; they do not create nested clients or bypass the transaction.
- Owner bootstrap and audit rows are database-enforced immutable records.
- Idempotent mutations reserve a bounded scope/key pair and compare the SHA-256 request
  hash before returning or completing prior work.
- Physical deletion is prohibited for identity and authority records. Identity deletion
  is a status plus timestamp transition; retention processing is separately authorized.

## Data Rules

- All persisted timestamps use PostgreSQL `TIMESTAMPTZ(3)` and serialize externally as
  ISO-8601 UTC strings.
- Decimal values cross API and repository boundaries as canonical decimal strings,
  never JavaScript numbers. No Gate 1 baseline table currently requires Decimal.
- Opaque Kernel, actor, request, correlation, and decision identifiers remain bounded
  strings unless their originating contract explicitly guarantees UUID format.
- Credential, recovery, and cryptographic material fields contain opaque references,
  never plaintext secrets.
- JSON details are structured, bounded, and redacted before persistence.

## Hosting And Recovery Boundary

No production PostgreSQL provider or region is selected. Production approval requires
encryption in transit and at rest, automated backups, point-in-time recovery, separate
backup failure alerts, documented retention, an Owner-approved region, and a witnessed
restore test. [Database recovery](recovery.md) defines the provider-neutral procedure.
