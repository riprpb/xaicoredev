# ADR-0017: Owner Bootstrap Ceremony

**Decision Number:** 0017  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive; execution separately gated

## Problem Statement

XAICore requires a permanent constitutional Owner identity that cannot be recreated,
replaced, or partially established.

## Context

The approved Gate 1 plan separates Owner Bootstrap from general identity. Private Root
Authority and recovery mechanisms cannot be exposed through general documentation,
prompts, manifests, or APIs.

## Options Considered

1. Create an Owner row through ordinary administrator tooling.
2. Bootstrap automatically on first application startup.
3. Use a one-time Owner-authorized ceremony with opaque security artifacts, immutable
   storage, sanitized audit, and failure cleanup.

## Decision

Coordinate a one-time ceremony through private authorization and security
providers. Atomically commit the immutable Owner record and sanitized completion audit.
Reject recreation and clean up provisioned artifacts after failure.

No implementation detail in this ADR authorizes ceremony execution. Execution requires
separate Owner approval after prerequisite review.

## Reasoning

The proposal preserves permanent Owner authority, prevents administrative replacement,
and avoids partially committed Root of Trust state without disclosing private control
mechanisms.

## Tradeoffs

Execution depends on protected local input, durable atomic storage, security artifact
custody, successor policy, and recovery procedures. These prerequisites deliberately
prevent an expedient but unsafe bootstrap.

## Future Impact

Permission and audit services consume the immutable ownership record through Kernel
contracts. They never recreate it or infer Owner authority from account attributes.

## Related Components

`src/identity/owner-bootstrap.ts`, Owner Bootstrap review, Root Authority information
boundary, Permission Engine, Audit, and database workstreams.

## Superseded Decisions

None.
