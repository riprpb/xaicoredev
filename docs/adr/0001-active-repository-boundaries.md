# ADR-0001: Active Repository Boundaries

**Decision Number:** 0001  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 0 approval

## Problem Statement

Active code, legacy exports, duplicate snapshots, archives, and generated files were
mixed together and all participated in tooling discovery.

## Context

Builds succeeded only because TypeScript included `src/`, while lint and tests swept
unverified material and failed with more than one thousand findings. Nothing could be
classified reliably as production source.

## Options Considered

1. Repair every imported file in place.
2. Delete legacy material and rebuild.
3. Separate active, legacy, archive, backup, generated, and documentation boundaries.

## Decision

Use `src/` as active source. Preserve unverified code in `legacy/reference`, compressed
and binary material in `archive`, and snapshots in `backups`. Only active source enters
quality gates or deployment.

## Reasoning

Separation restores trustworthy automation without destroying potentially useful work.

## Tradeoffs

Legacy recovery requires deliberate review. Ignored preservation directories require
external backup until repository history and artifact retention are established.

## Future Impact

Every recovered feature needs provenance, architecture, security, and test review.

## Related Components

`.gitignore`, `.eslintrc.cjs`, `vitest.config.ts`, `docs/architecture/repository-structure.md`.

## Superseded Decisions

None.
