# ADR-0015: Provider-Neutral Authentication Metadata

**Decision Number:** 0015
**Date:** 2026-06-22
**Status:** Accepted by Gate 1 plan approval

## Problem Statement

Gate 1 needs identity, session, device, MFA, and recovery domain boundaries before the
Owner selects local credentials or an external identity provider.

## Context

Selecting a provider prematurely would couple constitutional identity to deployment
infrastructure. Storing password hashes, tokens, factor secrets, or recovery codes in
general identity records would also broaden exposure.

## Options Considered

1. Pause all identity modeling until provider selection.
2. Implement local credentials as the default.
3. Model provider-neutral identity metadata and opaque material references only.

## Decision

Define provider-neutral users, credentials, provider links, devices, MFA factors,
recovery methods, and sessions. Sensitive material remains behind opaque references.
Session state fails closed and revocation returns an immutable result with reason and
correlation metadata.

## Reasoning

This advances the approved identity model without deciding the provider, exposing
credential material, or bypassing future Kernel authorization and audit enforcement.

## Tradeoffs

The model cannot authenticate a user by itself. Provider adapters, storage, token
handling, and security policies remain necessary after Owner decisions.

## Future Impact

The selected identity strategy implements verification behind Kernel-managed services.
Persistence maps these records without adding secret material to general identity
queries.

Owner recovery remains intentionally split. Owner MFA recovery codes are single-use
secrets displayed once and persisted only as salted hashes behind recovery-method
references with audit coverage for generation, regeneration, and use. Successor
recovery remains a separate opaque protected reference under an active approved policy,
with no automatic activation, no implicit credential issuance, and no constitutional
authority mutation.

## Related Components

`src/identity/authentication-model.ts`, constitutional identity documentation,
Permission Engine, Audit, Owner Bootstrap, and database workstreams.

## Superseded Decisions

None.
