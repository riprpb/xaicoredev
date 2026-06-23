# Database Recovery

## Required Evidence

Before production authorization, the selected PostgreSQL provider must demonstrate:

- Encrypted automated backups and point-in-time recovery.
- Backup storage isolated from ordinary application credentials.
- Recorded backup age, completion, and failure alerts.
- An Owner-approved recovery point objective and recovery time objective.
- Restoration into an isolated environment without overwriting the source database.
- Migration status, row-count, integrity, audit-chain, and application-readiness checks.
- Destruction of temporary restored data under the approved retention policy.

## Restore Exercise

1. Record the approved backup or recovery point and a correlation ID.
2. Create an isolated destination with separately scoped credentials.
3. Restore without changing the active application connection.
4. Run `prisma migrate status` and verify no failed or unexpected migrations.
5. Validate immutable Owner uniqueness, active Owner authority uniqueness, foreign keys,
   idempotency constraints, and audit-chain continuity.
6. Start the API against the isolated destination and verify readiness.
7. Record timings, results, exceptions, and rollback evidence in append-only audit.
8. Obtain Owner approval before any traffic or connection change.

No restore, failover, connection change, or production cutover may be executed by AI or
automation without authenticated Owner authorization through the Kernel and Permission
Engine.
