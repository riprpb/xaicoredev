# ADR-0012: Separate Constitutional Authority from Entitlements

**Decision Number:** 0012  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 1 plan approval

## Problem Statement

Product roles, subscription plans, and capabilities must never accidentally confer
constitutional platform authority.

## Context

Gate 1 requires a constitutional identity model before credentials, sessions,
permissions, Owner bootstrap, or business subscriptions are implemented.

## Options Considered

1. Use one role collection for authority and product access.
2. Infer authority from high-tier product entitlements.
3. Store constitutional authority assignments and product entitlements as independent
   domain records.

## Decision

Constitutional authority assignments and product entitlements are separate types,
records, lifecycle states, and evaluation functions. Entitlement capabilities never
participate in constitutional role evaluation.

Successor trust grants use opaque activation-policy and integrity-proof references so
the domain model can enforce required metadata without exposing private mechanisms.

## Reasoning

Structural separation prevents commercial or administrative state from escalating
into Owner or successor authority and preserves the constitutional chain.

## Tradeoffs

Callers must evaluate authority and entitlements separately. This deliberate
duplication avoids a dangerous shared-role abstraction.

## Future Impact

Persistence uses separate models and repositories. The Permission Engine consumes
constitutional assignments explicitly and never treats entitlement capabilities as
authority evidence.

## Related Components

`src/identity/model.ts`, constitutional identity security documentation, Permission
Engine, Owner Bootstrap, and database baseline workstreams.

## Superseded Decisions

None.
