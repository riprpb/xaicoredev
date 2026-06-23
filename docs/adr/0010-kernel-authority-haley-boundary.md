# ADR-0010: Kernel Authority and Haley Core Boundary

**Decision Number:** 0010  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

Kernel-centered diagrams alone do not prevent components or broad-awareness services
from acquiring direct peer integrations or unintended execution authority.

## Context

The Owner approved the Kernel as sole architectural authority and Haley Core as the
Executive Intelligence and Platform Awareness layer with comprehensive visibility but
minimal execution authority.

## Options Considered

1. Rely on documentation while retaining direct awareness-source injection.
2. Give Haley Core general Kernel execution access.
3. Require Kernel-managed interfaces universally and give Haley Core a read-only
   Kernel gateway.

## Decision

All platform communication uses approved Kernel contracts, registries, events, ports,
or other Kernel-managed interfaces. A bypass requires explicit authorization by an
accepted Kernel architecture ADR and remains Kernel-managed.

Haley Core receives only `KernelReadGateway`. It may observe, aggregate, analyze,
report, recommend, and request Owner approval. It cannot mutate platform state,
authority, permissions, registries, Feature Flags, or infrastructure, and it cannot
execute privileged operations.

Privileged operations follow `Owner -> Kernel -> Permission Engine -> Authorized
Platform Service -> Registry or Target Component`.

## Reasoning

A distinct read-only gateway makes Haley Core's minimal authority visible in the type
system while central mediation eliminates hidden runtime dependencies and preserves
authorization and audit control.

## Tradeoffs

All adapters require Kernel integration and correlation context. This adds deliberate
routing work but provides consistent policy, observability, and maintainability.

## Future Impact

Architecture tests will reject peer-to-peer runtime integrations. New component types
and any proposed exception require Kernel contract review and an accepted ADR.

## Related Components

`src/platform/kernel`, `src/platform/haley-core`, Engineering Standards, Kernel-centered
architecture, and Haley Core architecture.

## Superseded Decisions

None. This decision clarifies ADR-0008 and ADR-0009.
