# ADR-0006: Gate Release Tags

**Decision Number:** 0006  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

Completed architecture Gates need permanent, auditable source-control markers.

## Context

XAICore development is governed by explicit phase approvals. Documentation or status
messages alone cannot identify the exact source state that passed a Gate.

## Options Considered

1. Record completion only in documentation.
2. Use movable branches as milestones.
3. Create an annotated semantic Git tag after each verified Gate commit.

## Decision

Every completed Gate receives an immutable annotated tag using
`v<major>.<minor>.<patch>-gate<number>`.

## Reasoning

Annotated tags bind milestone evidence to an exact commit and preserve release history.

## Tradeoffs

Tagging requires clean Git history and disciplined verification. Incorrect published
tags must be superseded rather than silently moved.

## Future Impact

CI should verify tag format and attach build, test, security, and assessment evidence.

## Related Components

Git repository, CI pipeline, Gate assessments, deployment documentation.

## Superseded Decisions

None.
