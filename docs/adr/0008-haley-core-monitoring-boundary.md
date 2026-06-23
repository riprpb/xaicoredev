# ADR-0008: Haley Core Monitoring Boundary

**Decision Number:** 0008  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

Gate 1 needs executive platform awareness before the complete Haley AI is permitted.

## Context

Monitoring must span manifests, registries, feature flags, health, repository state,
architecture, and logs without granting AI or automation constitutional authority or
disclosing private Root Authority mechanisms.

## Options Considered

1. Defer all Haley-related work until advanced AI is authorized.
2. Implement the complete Haley AI during Gate 1.
3. Establish a non-AI, read-only Haley Core monitoring service.

## Decision

Implement Haley Core as a platform service behind read-only awareness contracts. It
produces sanitized diagnostic snapshots and has no privileged mutation or AI execution
capability.

## Reasoning

This provides early operational visibility while preserving least privilege, Kernel
authority, deferred AI scope, and private security architecture.

## Tradeoffs

Adapters and persistence arrive in later workstreams. Early snapshots may be partial,
so source failures are represented as degraded diagnostics rather than hidden.

## Future Impact

The authenticated Owner dashboard may consume Haley Core summaries. Advanced Haley AI
behavior requires separate Owner approval and must not expand Haley Core authority.

## Related Components

`src/platform/haley-core`, `docs/architecture/haley-core.md`,
`docs/security/root-authority-boundary.md`.

## Superseded Decisions

None.
