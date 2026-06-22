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
