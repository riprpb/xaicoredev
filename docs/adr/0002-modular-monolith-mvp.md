# ADR-0002: Modular Monolith for the MVP

**Decision Number:** 0002  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 0 approval

## Problem Statement

XAICore needs enforceable platform boundaries without premature distributed-system
complexity.

## Context

The current team and active code are small, while the long-term platform may include
many independently scalable services and AI agents.

## Options Considered

1. Immediate microservices for every platform capability.
2. Unstructured single application.
3. Modular monolith with explicit contracts and extraction-ready interfaces.

## Decision

Launch as a modular monolith. Keep Kernel contracts independent from UI and business
modules, and extract services only when scale or ownership evidence justifies it.

## Reasoning

This produces the shortest secure path to revenue while protecting long-term modularity.

## Tradeoffs

Process isolation is deferred. Boundaries must be enforced through code review, tests,
manifests, and dependency rules until physical extraction is warranted.

## Future Impact

Modules may move to independent deployments without changing their public contracts.

## Related Components

`src/platform`, `docs/architecture/platform-overview.md`, module dependency diagram.

## Superseded Decisions

None.
