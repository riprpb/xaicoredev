# ADR-0009: Kernel-Centered Platform Integration

**Decision Number:** 0009  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

Independent platform modules can drift into peer-to-peer integrations that bypass
constitutional authority, permission evaluation, observability, and audit.

## Context

XAICore requires one enforceable architectural center for services, registries, AI,
providers, memory, configuration, permissions, events, and lifecycle operations.

## Options Considered

1. Allow direct module integrations with local authorization.
2. Use an ungoverned event mesh as the integration center.
3. Route runtime platform operations through Kernel contracts and registered ports.

## Decision

The System Kernel is the single runtime architectural center. Every platform component
integrates through Kernel request contexts, the Kernel gateway, Kernel-owned
infrastructure ports, and registered component ports. Peer-to-peer runtime platform
dependencies are prohibited.

## Reasoning

Central routing makes authentication, explicit permission decisions, correlation,
audit, lifecycle governance, and fail-closed behavior structurally enforceable.

## Tradeoffs

The Kernel contract surface becomes critical infrastructure and requires strict
versioning, focused scope, high test coverage, and protection from business logic.

## Future Impact

Existing Gate 0 implementations will receive Kernel adapters before persistent or
privileged behavior is enabled. Static dependency and integration tests should prevent
runtime bypass paths.

## Related Components

`src/platform/kernel`, `src/platform/permissions`, `src/platform/audit`,
`src/platform/config`, `src/platform/events`, and architecture dependency diagrams.

## Superseded Decisions

None. This decision specializes ADR-0002 and ADR-0005.
