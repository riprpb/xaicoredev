# ADR-0005: Contract-First Platform Foundations

**Decision Number:** 0005  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 0 approval

## Problem Statement

AI and business features require stable registration, memory, provider, trust, feature
flag, lifecycle, health, and manifest boundaries before implementation.

## Context

The Owner approved contract foundations during Gate 0 but prohibited AI functionality,
business memory, scanning, and business feature implementation.

## Options Considered

1. Wait until each feature invents its own interfaces.
2. Implement full infrastructure immediately.
3. Establish validated contracts and minimal deterministic contract behavior only.

## Decision

Create Kernel-level TypeScript contracts, manifest validation, secure-default feature
flags, and an in-memory AI registration lifecycle. Do not activate business behavior.

## Reasoning

Early contracts prevent direct provider calls, hidden dependencies, and incompatible
agent architectures while preserving Gate 0 scope.

## Tradeoffs

Contracts will evolve as Gate 1 persistence and authority requirements are specified.
Versioning is required to avoid silent breaking changes.

## Future Impact

Gate 1 adds persistence, authorization, audit, configuration, and production adapters
behind these interfaces.

## Related Components

`src/platform`, `config/manifests`, architecture design documents.

## Superseded Decisions

None.
