# ADR-0016: Initial Local Credential Strategy

**Decision Number:** 0016  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

Workstream 2 requires an initial authentication strategy before credential hashing,
upgrade, and brute-force policies can be implemented.

## Context

The Owner approved local credentials for initial development while deployment and
external identity providers remain undecided. Owner Bootstrap remains a separate
workstream and no personal account data belongs in committed source.

## Options Considered

1. Wait for an external identity provider.
2. Implement provider-specific hosted identity now.
3. Use local credentials behind provider-neutral identity records and Kernel-managed
   services.

## Decision

Use local credentials for initial development. Hash passwords asynchronously with
Node.js scrypt using policy version 1: `N=2^17`, `r=8`, `p=1`, a unique 16-byte random
salt, and a 32-byte derived key. Use constant-time comparison and versioned upgrade
detection.

Require 15 to 128 characters, allow all character classes without composition rules,
and apply bounded login-failure state. Passwords, hashes, salts, recovery data, and
personal Owner information never enter source, tests, logs, or general documentation.

## Reasoning

Node scrypt is available across the supported Node range and meets current OWASP
fallback guidance where Argon2id is unavailable. Versioned records permit a future
Argon2id or external-provider migration.

## Tradeoffs

Local credential security requires persistent throttling, compromised-password
screening, MFA, secure recovery, secret management, and operational protection before
production use. The current implementation is not an authorization to create a
production account.

## Future Impact

Workstream 3 supplies Owner identity only through ignored local bootstrap inputs and an
audited one-time ceremony. External providers remain adapters and do not change
constitutional identity records.

## Related Components

`src/identity/local-credentials.ts`, constitutional identity documentation, Kernel
configuration, Owner Bootstrap, Permission Engine, Audit, and database workstreams.

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Crypto documentation](https://nodejs.org/api/crypto.html)

## Superseded Decisions

None.
