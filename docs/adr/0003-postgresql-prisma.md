# ADR-0003: PostgreSQL and Prisma

**Decision Number:** 0003  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 0 approval

## Problem Statement

The active scaffold used PostgreSQL and Prisma while legacy fragments used MySQL and
Drizzle, creating two incompatible persistence directions.

## Context

Gate 1 requires reliable transactions, migrations, identity, permission, audit, KYC,
and billing records. No production database exists yet.

## Options Considered

1. Adopt legacy MySQL and Drizzle.
2. Maintain both stacks.
3. Standardize active development on PostgreSQL and Prisma.

## Decision

Use PostgreSQL and Prisma for the MVP. All schema changes are migration-driven and
version controlled.

## Reasoning

This is the coherent active path and supports transactional, relational Tier 1 data.

## Tradeoffs

Legacy schemas require mapping rather than direct reuse. Prisma migration and Decimal
serialization policies must be established in Gate 1.

## Future Impact

Specialized stores may be added behind repository contracts when justified; PostgreSQL
remains the authoritative transactional store.

## Related Components

`prisma/schema.prisma`, `docs/database/README.md`.

## Superseded Decisions

None.
