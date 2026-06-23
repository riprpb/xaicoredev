# ADR-0013: Typed Runtime Configuration and Secret References

**Decision Number:** 0013  
**Date:** 2026-06-22  
**Status:** Accepted by Gate 1 Workstream 1 approval

## Problem Statement

Runtime settings, sensitive references, and raw secrets require different handling and
must fail safely across local and deployed environments.

## Context

Gate 1 requires typed startup validation for development, test, staging, and production
without selecting a provider-specific production secret store prematurely.

## Options Considered

1. Read unvalidated environment variables throughout the application.
2. Return public values, references, and secrets through one configuration object.
3. Use a typed loader and Kernel adapter that expose public values and opaque references
   while denying raw secret reads.

## Decision

Use a registered configuration descriptor schema and validated runtime profiles.
Staging and production require explicit host and secure origin settings. The Kernel
configuration adapter returns registered public values or opaque references, denies raw
secret reads, and rejects cross-profile contexts.

Production secret resolution remains an adapter behind an Owner-selected provider. No
provider-specific storage is implemented before that decision.

## Reasoning

The design makes configuration failures deterministic, prevents accidental secret
exposure, preserves provider independence, and keeps reads within Kernel contracts.

## Tradeoffs

New settings require descriptor and mapping registration. This explicit work prevents
undocumented configuration and is protected by focused coverage thresholds.

## Future Impact

The selected production provider will implement reference resolution without changing
the public runtime configuration shape. Provider selection requires Owner approval and
its own security review.

## Related Components

`src/config/environment.ts`, `src/config/runtime-service.ts`, `.env.example`, runtime
configuration documentation, and Workstream 1 verification evidence.

## Superseded Decisions

None.
