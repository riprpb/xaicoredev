# ADR-0011: Controlled Platform Foundations Baseline

**Decision Number:** 0011  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

Continued architectural expansion of a sufficiently mature foundation would delay
Gate 1 implementation and risk unnecessary redesign.

## Context

The Owner approved the current Platform Foundations document as XAICore's baseline
architectural standard and directed engineering toward implementation.

## Options Considered

1. Continue expanding the foundation during implementation.
2. Freeze all documentation and prevent corrections.
3. Control the baseline through ADR review and expand responsibilities only with Owner
   approval.

## Decision

Treat `src/platform/README.md` as a controlled engineering standard. Every change
requires an ADR. Responsibility expansion additionally requires Owner approval. Gate 1
work preserves infrastructure/business separation, awareness/authority separation,
Kernel-centered integration, and Haley Core's monitoring and advisory boundary.

## Reasoning

Change control protects the approved architecture while permitting critical fixes and
documented evolution.

## Tradeoffs

Even small baseline corrections require decision-record overhead. This is acceptable
because the document governs permanent platform boundaries.

## Future Impact

Implementation, testing, verification, and maintainability take priority over
redesign. Architecture expands only for a demonstrated critical issue or explicit
Owner-approved need.

## Related Components

`src/platform/README.md`, Engineering Standards, Gate 1 plan, ADR-0009, ADR-0010.

## Superseded Decisions

None.
