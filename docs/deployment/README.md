# Deployment Documentation

Gate 0 defines CI quality gates. Environment topology, Infrastructure as Code, staging,
production approval, rollback, backup, disaster recovery, and release runbooks require
deployment-target approval before implementation.

See [Release and Gate Versioning](release-versioning.md) for immutable tags, approval
ordering, evidence requirements, Gate corrections, and rollback rules.

See [Runtime Configuration](runtime-configuration.md) for typed profiles, startup
validation, configuration visibility, and the pending secret-provider boundary.

## Deployment Philosophy

Deployment is a controlled engineering activity, not a development activity.

Engineering completion and production deployment are separate approval stages.

No deployment shall occur until all required Gate verification, security validation,
documentation, architecture review, and Owner approval requirements have been
satisfied.

Every deployment shall support:

- Health verification.
- Readiness verification.
- Rollback capability.
- Audit logging.
- Version identification.
- Deployment evidence.
- Post-deployment validation.

Deployment shall always prioritize:

- Platform stability.
- User safety.
- Data integrity.
- Security.
- Recoverability.
- Observability.
- Repeatability.

Every production deployment requires explicit Owner authorization.

No AI, automation, workflow, administrator, deployment pipeline, or platform component
may independently deploy to production without Owner approval.

Deployment approval remains part of the constitutional authority model.

No deployment process shall bypass constitutional authority or established release
governance.

## CI Quality Gates

Gate 0 establishes the following CI quality gates enforced on every pull request and
push to `main` and `development`:

| Check | Command |
| --- | --- |
| Clean install | `npm ci --ignore-scripts` |
| Prisma client generation | `npm run db:generate` |
| Schema validation | `npm run db:validate` |
| Database migration | `npm run db:migrate:deploy` |
| TypeScript type check | `npm run type-check` |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Production build | `npm run build` |
| Dependency audit | `npm audit --audit-level=high` |
| Secret scan | gitleaks (full history) |

CI runs against a live PostgreSQL 16 service container. No pull request or push may
merge if any check fails.

A Gate release additionally requires a Gate Assessment, Architecture Assessment,
Security Assessment, Dependency Audit, documentation synchronization, and Owner
approval before an annotated tag is created.

See [Release and Gate Versioning](release-versioning.md) for tag format and immutability
rules.

## Environment Topology

**Status:** Planned — requires deployment-target approval.

Planned environments:

- **Development:** local workstation. No external provider required.
- **Test:** automated CI environment. Ephemeral PostgreSQL service container.
- **Staging:** production-like environment. Provider, region, and hosting selection
  pending deployment-target approval.
- **Production:** live environment. Requires staging validation and Owner approval
  before any deployment.

No staging or production environment exists or is configured. All topology decisions,
provider selection, region, and network design require Owner approval before
implementation.

## Infrastructure as Code

**Status:** Planned — requires deployment-target approval.

No Infrastructure as Code is authored until the deployment provider and topology are
Owner-approved. IaC shall be version-controlled, reviewed, and validated before any
environment is provisioned. No manual provisioning may substitute for approved IaC
except in explicitly authorized emergency procedures.

## Health and Readiness

Deployment health verification uses the active API endpoints:

- `GET /api/health` — aggregate platform health.
- `GET /api/health/ready` — readiness of required dependencies. Returns HTTP 503 when
  any required dependency is unavailable.
- `GET /api/health/live` — liveness of the server process.
- `GET /api/health/version` — active version and build identity.

A deployment is not considered successful until the readiness endpoint returns healthy.
Deployment tooling must verify readiness after every deploy and before directing
traffic.

See [Observability](../operations/observability.md) for structured log, metrics, and
alert requirements.

## Staging

**Status:** Planned — requires deployment-target approval.

Staging validation is a mandatory gate before any production deployment. A staging
environment must:

- Mirror production configuration, infrastructure, and data classification controls.
- Execute the full migration path against a staging database before production.
- Pass all health and readiness checks.
- Receive Owner sign-off before promotion to production.

No deployment may advance to production without a recorded staging validation result.

## Production Approval

Every production deployment requires explicit Owner authorization recorded before
execution begins.

Production deployment authorization must include:

- Gate or release version being deployed.
- Staging validation evidence.
- Security scan results.
- Rollback procedure confirmed available.
- Owner approval record with timestamp and reason.

No pipeline, AI, automation, or administrator may initiate a production deployment
without a recorded Owner approval. Approval records are appended to the deployment
audit log and retained permanently.

Owner-reserved permissions (`deployment:execute`, `deployment:rollback`) require active
Owner authority, multi-factor assurance, fresh reauthentication, and an explicit
reason. See [Workstream 4](../roadmap/gate-one-implementation-plan.md) for the
permission engine that enforces this boundary.

## Rollback

Every production deployment must have a tested rollback procedure confirmed before
deployment authorization is granted.

Rollback requirements:

- The previous release artifact must be available and verified before deployment begins.
- Database rollback capability must be confirmed or migration-safe forward-only policy
  must be explicitly accepted.
- Rollback execution is an Owner-reserved operation requiring the same approval as a
  forward deployment.
- Rollback completion must be followed by a full health and readiness verification.
- The rollback event must be recorded in the deployment audit log.

Rollback runbooks are authored per release once a deployment target is approved.

## Backup and Disaster Recovery

**Status:** Planned — requires deployment-target approval.

No backup or disaster recovery procedures are implemented until the deployment provider,
database hosting, and data residency requirements are Owner-approved.

Backup and DR requirements that will apply once a target is approved:

- Automated, verified, and encrypted database backups.
- Point-in-time recovery capability covering the minimum retention window required by
  approved legal and operational policy.
- Backup restore verification on a schedule approved by the Owner.
- Geographic redundancy policy reviewed and approved before production data is stored.
- Disaster recovery runbook with tested recovery time and recovery point objectives.
- DR tests recorded and retained as operational evidence.

No production data may be stored before backup, encryption-at-rest, and DR procedures
are Owner-approved and verified.

## Release Runbooks

**Status:** Planned — requires deployment-target approval.

Deployment runbooks are authored for each release once a deployment target is selected
and approved. Each runbook covers:

- Pre-deployment checklist (CI evidence, staging validation, Owner approval record).
- Deployment execution steps.
- Post-deployment health and readiness verification.
- Rollback decision criteria and execution steps.
- Escalation contacts and Owner notification procedure.
- Evidence and audit log completion requirements.

No production deployment may proceed without a completed pre-deployment checklist
signed by the Owner.
