# ADR-0004: Quarantine and Selectively Recover Legacy Source

**Decision Number:** 0004  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 0 approval

## Problem Statement

Historical files contain useful concepts but also missing dependencies, syntax errors,
duplicate implementations, hard-coded authority checks, and architecture conflicts.

## Context

Wholesale integration would recreate technical debt and weaken constitutional controls.
Deletion would discard potentially useful design work.

## Options Considered

1. Merge the entire export.
2. Delete the export.
3. Preserve it read-only and recover features individually.

## Decision

Quarantine legacy source outside active tooling and apply a per-feature salvage review.

## Reasoning

This preserves knowledge while making active quality claims evidence-based.

## Tradeoffs

Some feature work will be rewritten when salvage costs exceed value. Historical status
claims no longer count as implementation evidence.

## Future Impact

Recovery changes must document provenance, dependencies, tests, and security analysis.

## Related Components

`legacy/reference`, `archive`, `backups`, `docs/reference`.

## Superseded Decisions

None.
