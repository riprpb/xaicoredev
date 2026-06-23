# Architecture Decision Records

ADRs preserve significant technical decisions. Records are immutable after acceptance;
later decisions supersede rather than rewrite history.

## Process

1. Copy `template.md` to the next four-digit number and descriptive slug.
2. Mark the status `Proposed` while review is open.
3. Record Owner approval and change the status to `Accepted`.
4. Link code, diagrams, security reviews, and superseding ADRs.

## Index

- [ADR-0001: Active repository boundaries](0001-active-repository-boundaries.md)
- [ADR-0002: Modular monolith for the MVP](0002-modular-monolith-mvp.md)
- [ADR-0003: PostgreSQL and Prisma](0003-postgresql-prisma.md)
- [ADR-0004: Quarantine and selectively recover legacy source](0004-legacy-quarantine.md)
- [ADR-0005: Contract-first Gate 0 foundations](0005-contract-first-platform-foundations.md)
- [ADR-0006: Gate release tags](0006-gate-release-tags.md)
- [ADR-0007: Gate evidence archive and approval ordering](0007-gate-evidence-archive.md)
- [ADR-0008: Haley Core monitoring boundary](0008-haley-core-monitoring-boundary.md)
- [ADR-0009: Kernel-centered platform integration](0009-kernel-centered-platform.md)
- [ADR-0010: Kernel authority and Haley Core boundary](0010-kernel-authority-haley-boundary.md)
- [ADR-0011: Controlled Platform Foundations baseline](0011-controlled-platform-foundations-baseline.md)
- [ADR-0012: Constitutional authority and entitlement separation](0012-constitutional-authority-entitlement-separation.md)
- [ADR-0013: Typed runtime configuration and secret references](0013-typed-runtime-configuration.md)
- [ADR-0014: Primary repository identity](0014-primary-repository-identity.md)
- [ADR-0015: Provider-neutral authentication metadata](0015-provider-neutral-authentication-metadata.md)
- [ADR-0016: Initial local credential strategy](0016-initial-local-credential-strategy.md)
- [ADR-0017: Owner Bootstrap ceremony](0017-owner-bootstrap-ceremony.md)
